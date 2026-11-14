import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderSize } from './dto/create-order.dto';
import { OrderStatus } from './entities/order.entity';
import type { AuthUser } from '../common/auth/auth-user.interface';

const customer: AuthUser = { id: 'u1', role: 'CUSTOMER' };
const other: AuthUser = { id: 'u2', role: 'CUSTOMER' };

const item = { productId: '1', size: OrderSize.S, qty: 1 };

describe('Order state và tồn kho (regression)', () => {
  let repo: OrdersRepository;
  let products: ProductsService;
  let orders: OrdersService;
  beforeEach(() => {
    repo = new OrdersRepository();
    products = new ProductsService();
    orders = new OrdersService(repo, products);
  });

  it('chặn bước bị bỏ qua và đi hết luồng chính PAID → PREPARING → READY → COMPLETED', async () => {
    const order = await orders.createOrder(customer, { items: [item] });
    await expect(
      orders.updateOrderStatus(customer, order.id, OrderStatus.READY),
    ).rejects.toThrow(BadRequestException);
    for (const status of [
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
    ]) {
      expect(
        (await orders.updateOrderStatus(customer, order.id, status)).status,
      ).toBe(status);
    }
    for (const status of Object.values(OrderStatus)) {
      await expect(
        orders.updateOrderStatus(customer, order.id, status),
      ).rejects.toThrow(BadRequestException);
    }
    expect((await orders.findOne(order.id, customer)).status).toBe(
      OrderStatus.COMPLETED,
    );
  });

  it('hủy đồng thời 10 lần chỉ hoàn stock đúng một lần', async () => {
    products.setStockForTest('1', 3);
    const order = await orders.createOrder(customer, { items: [item] });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        orders.updateOrderStatus(customer, order.id, OrderStatus.CANCELLED),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await products.findOneFromStorage('1'))?.stock).toBe(3);
  });

  it('rollback một reservation thất bại không hỏng reservation song song khác', async () => {
    products.setStockForTest('1', 3);
    let rejectSave!: (error: Error) => void;
    const pendingSave = new Promise<void>((_, reject) => {
      rejectSave = reject;
    });
    const failed = products.withStockReservation(
      [{ productId: '1', qty: 1 }],
      () => pendingSave,
    );
    const assertion = expect(failed).rejects.toThrow('storage failure');
    // Đơn của u2 xếp sau trong hàng đợi, vẫn tạo thành công với stock đúng.
    const successful = orders.createOrder(other, { items: [item] });
    rejectSave(new Error('storage failure'));
    await assertion;
    await successful;
    expect((await products.findOneFromStorage('1'))?.stock).toBe(2);
    expect(await orders.findMyOrders(other.id)).toHaveLength(1);
  });

  it('nhánh Prisma: version cũ bị chặn bằng ConflictException, không tạo đơn', async () => {
    const tx = {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: '1', name: 'Cà Phê', price: 45000, stock: 3, version: 7 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      order: { create: jest.fn() },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    };
    orders = new OrdersService(repo, products, prisma as unknown as PrismaService);
    await expect(
      orders.createOrder(customer, { items: [item] }),
    ).rejects.toThrow(ConflictException);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: '1', version: 7, stock: { gte: 1 } },
      data: { stock: { decrement: 1 }, version: { increment: 1 } },
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('nhánh Prisma: thiếu hàng → 400 ngay khi tạo đơn (không đợi đến thanh toán)', async () => {
    const tx = {
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: '1', name: 'Cà Phê', price: 45000, stock: 0, version: 0 }),
        updateMany: jest.fn(),
      },
      order: { create: jest.fn() },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    };
    orders = new OrdersService(repo, products, prisma as unknown as PrismaService);
    await expect(
      orders.createOrder(customer, { items: [item] }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
