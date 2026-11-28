import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { ProductsService } from '../products/products.service';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { OrderStatus } from './entities/order.entity';
import { CreateOrderItemDto, OrderSize } from './dto/create-order.dto';

const user: AuthUser = {
  id: 'test-user-id',
  email: 'customer@example.com',
  role: 'CUSTOMER',
};

describe('OrdersService (nhánh in-memory, không cần DB)', () => {
  let service: OrdersService;
  let products: ProductsService;

  beforeEach(() => {
    products = new ProductsService();
    service = new OrdersService(new OrdersRepository(), products);
  });

  const item: CreateOrderItemDto = {
    productId: '1',
    size: OrderSize.M,
    qty: 2,
    toppings: ['Shot Espresso thêm'],
  };

  it('tạo đơn với giá tính trên server và trừ tồn kho', async () => {
    // Product 1: Cappuccino Espresso 45000 + size M 5000 + topping 15000 = 65000
    const order = await service.createOrder(user, { items: [item] });

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.total).toBe(130000);
    expect(order.items[0]).toMatchObject({
      productId: '1',
      productName: 'Cappuccino Espresso',
      size: 'M',
      unitPrice: 65000,
      lineTotal: 130000,
      toppings: ['Shot Espresso thêm'],
    });
    expect((await products.findOneFromStorage('1'))?.stock).toBe(48);
  });

  it('giỏ trống → 400', async () => {
    await expect(
      service.createOrder(user, { items: [] }),
    ).rejects.toThrow(BadRequestException);
    expect((await products.findOneFromStorage('1'))?.stock).toBe(50);
  });

  it('chặn lần dùng voucher thứ hai của cùng tài khoản và hoàn lại tồn kho', async () => {
    const dto = { items: [item], voucherCode: 'welcome10' };
    await service.createOrder(user, dto);

    await expect(service.createOrder(user, dto)).rejects.toThrow(
      'Bạn đã sử dụng mã "WELCOME10".',
    );
    expect((await products.findOneFromStorage('1'))?.stock).toBe(48);
  });

  it('topping lạ hoặc trùng → 400, không trừ stock', async () => {
    await expect(
      service.createOrder(user, {
        items: [{ ...item, toppings: ['Trân châu'] }],
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createOrder(user, {
        items: [{ ...item, toppings: ['Shot Espresso thêm', 'Shot Espresso thêm'] }],
      }),
    ).rejects.toThrow(BadRequestException);
    expect((await products.findOneFromStorage('1'))?.stock).toBe(50);
  });

  it('sản phẩm không tồn tại → 404', async () => {
    await expect(
      service.createOrder(user, { items: [{ ...item, productId: '9999' }] }),
    ).rejects.toThrow(NotFoundException);
  });

  describe('quyền xem đơn', () => {
    it('chủ đơn được xem đơn của mình', async () => {
      const order = await service.createOrder(user, { items: [item] });
      await expect(service.findOne(order.id, user)).resolves.toMatchObject({
        id: order.id,
      });
    });

    it('user khác xem đơn của người khác → Forbidden', async () => {
      const order = await service.createOrder(user, { items: [item] });
      const stranger: AuthUser = { id: 'other-user-id', role: 'CUSTOMER' };
      await expect(service.findOne(order.id, stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ADMIN được xem đơn của bất kỳ ai', async () => {
      const order = await service.createOrder(user, { items: [item] });
      const admin: AuthUser = { id: 'admin-id', role: 'ADMIN' };
      await expect(service.findOne(order.id, admin)).resolves.toMatchObject({
        id: order.id,
      });
    });

    it('đơn không tồn tại → 404', async () => {
      await expect(service.findOne(999, user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('lịch sử đơn', () => {
    it('GET /orders/me trả đơn mới nhất trước', async () => {
      await service.createOrder(user, { items: [{ ...item, qty: 1 }] });
      await service.createOrder(user, { items: [{ ...item, qty: 1 }] });
      const orders = await service.findMyOrders(user.id);
      expect(orders).toHaveLength(2);
      expect(orders[0].id).toBeGreaterThan(orders[1].id);
    });

    it('chỉ trả đơn của chính mình, không lẫn đơn người khác', async () => {
      const stranger: AuthUser = { id: 'other-user-id', role: 'CUSTOMER' };
      const mine = await service.createOrder(user, { items: [{ ...item, qty: 1 }] });
      await service.createOrder(stranger, { items: [{ ...item, qty: 1 }] });
      const orders = await service.findMyOrders(user.id);
      expect(orders.map((o) => o.id)).toEqual([mine.id]);
    });

    it('người chưa có đơn nhận danh sách rỗng', async () => {
      await expect(service.findMyOrders('no-orders-user')).resolves.toEqual([]);
    });

    it('mỗi đơn có mã hiển thị, số món và giờ tạo dạng ISO', async () => {
      await service.createOrder(user, { items: [item] });
      const [order] = await service.findMyOrders(user.id);
      expect(order.code).toBe(`#${order.id}`);
      expect(order.itemCount).toBe(2);
      expect(() => new Date(order.createdAt).toISOString()).not.toThrow();
    });
  });

  describe('máy trạng thái', () => {
    it('chặn bước bị bỏ qua và đi được hết luồng chính', async () => {
      const order = await service.createOrder(user, { items: [item] });
      await expect(
        service.updateOrderStatus({ ...user, role: 'ADMIN' }, order.id, OrderStatus.READY),
      ).rejects.toThrow(BadRequestException);
      await service.updateStatus(order.id, OrderStatus.PAID);
      for (const status of [
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.COMPLETED,
      ]) {
        expect(
          (await service.updateOrderStatus({ ...user, role: 'ADMIN' }, order.id, status)).status,
        ).toBe(status);
      }
      // COMPLETED là trạng thái kết thúc
      await expect(
        service.updateOrderStatus({ ...user, role: 'ADMIN' }, order.id, OrderStatus.CANCELLED),
      ).rejects.toThrow(BadRequestException);
    });

    it('hủy đơn hoàn lại tồn kho', async () => {
      const order = await service.createOrder(user, { items: [item] });
      expect((await products.findOneFromStorage('1'))?.stock).toBe(48);
      const cancelled = await service.updateOrderStatus(
        user,
        order.id,
        OrderStatus.CANCELLED,
      );
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect((await products.findOneFromStorage('1'))?.stock).toBe(50);
    });

    it('người lạ không được chuyển trạng thái đơn của người khác', async () => {
      const order = await service.createOrder(user, { items: [item] });
      const stranger: AuthUser = { id: 'other-user-id', role: 'CUSTOMER' };
      await expect(
        service.updateOrderStatus(stranger, order.id, OrderStatus.CANCELLED),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
