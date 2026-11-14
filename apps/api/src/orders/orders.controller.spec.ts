import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { ProductsService } from '../products/products.service';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { OrderSize } from './dto/create-order.dto';

/** Task 9 – 2 route xem đơn: GET /orders/me và GET /orders/:id (nhánh in-memory). */
describe('OrdersController – xác nhận & lịch sử đơn (Task 9)', () => {
  const owner: AuthUser = { id: 'owner-id', email: 'a@phuclong.vn', role: 'CUSTOMER' };
  const stranger: AuthUser = { id: 'stranger-id', email: 'b@phuclong.vn', role: 'CUSTOMER' };
  const req = (user: AuthUser) => ({ user }) as Request & { user: AuthUser };

  let controller: OrdersController;
  let service: OrdersService;

  beforeEach(() => {
    service = new OrdersService(new OrdersRepository(), new ProductsService());
    controller = new OrdersController(service);
  });

  const createOrder = (user: AuthUser) =>
    service.createOrder(user, {
      items: [{ productId: '1', size: OrderSize.M, qty: 1, toppings: [] }],
    });

  it('GET /orders/:id trả phiếu xác nhận, không lộ userId', async () => {
    const created = await createOrder(owner);
    const order = await controller.getById(req(owner), String(created.id));

    expect(order).toMatchObject({
      id: created.id,
      code: `#${created.id}`,
      status: 'PENDING',
      itemCount: 1,
    });
    expect(order).not.toHaveProperty('userId');
  });

  it('GET /orders/:id của người khác → 403', async () => {
    const created = await createOrder(owner);
    await expect(controller.getById(req(stranger), String(created.id))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('GET /orders/:id không tồn tại hoặc id không phải số → 404', async () => {
    await expect(controller.getById(req(owner), '999999')).rejects.toThrow(NotFoundException);
    await expect(controller.getById(req(owner), 'abc')).rejects.toThrow(NotFoundException);
  });

  it('GET /orders/me chỉ trả đơn của người gọi', async () => {
    const mine = await createOrder(owner);
    await createOrder(stranger);
    const orders = await controller.getMyOrders(req(owner));
    expect(orders.map((o) => o.id)).toEqual([mine.id]);
  });
});
