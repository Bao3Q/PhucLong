import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { ProductsService } from '../products/products.service';
import { OrderSize } from './dto/create-order.dto';
import type { AuthUser } from '../common/auth/auth-user.interface';

const customer: AuthUser = { id: 'u1', role: 'CUSTOMER' };

describe('Server pricing (không bao giờ tin giá do client gửi)', () => {
  // Client cố tình gửi productName/unitPrice giả — DTO đã chặn (whitelist)
  // và backend chỉ tra catalog + bảng giá server-side.
  const input = {
    productId: '1',
    size: OrderSize.L,
    toppings: ['Shot Espresso thêm'],
    qty: 2,
  };

  it('tính giá từ catalog: 45000 + size L 10000 + topping 15000 = 70000/ly', async () => {
    const service = new OrdersService(
      new OrdersRepository(),
      new ProductsService(),
    );
    const order = await service.createOrder(customer, { items: [input] });
    expect(order.total).toBe(140000);
    expect(order.items[0]).toMatchObject({
      productName: 'Cappuccino Espresso',
      unitPrice: 70000,
      lineTotal: 140000,
    });
  });

  it.each([['Topping lạ'], ['Shot Espresso thêm', 'Shot Espresso thêm']])(
    'chặn topping lạ/trùng và không trừ stock: %j',
    async (...toppings) => {
      const products = new ProductsService();
      const service = new OrdersService(new OrdersRepository(), products);
      await expect(
        service.createOrder(customer, {
          items: [{ ...input, toppings: [...toppings] }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect((await products.findOneFromStorage('1'))?.stock).toBe(50);
    },
  );

  it('qty sai (0, âm, lẻ) → 400', async () => {
    const products = new ProductsService();
    const service = new OrdersService(new OrdersRepository(), products);
    for (const qty of [0, -1, 1.5]) {
      await expect(
        service.createOrder(customer, {
          items: [{ ...input, qty: qty as number }],
        }),
      ).rejects.toThrow(BadRequestException);
    }
    expect((await products.findOneFromStorage('1'))?.stock).toBe(50);
  });
});
