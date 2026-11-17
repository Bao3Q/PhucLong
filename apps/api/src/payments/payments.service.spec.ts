import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Prisma } from '../generated/prisma/client';
import type { OrdersService } from '../orders/orders.service';
import type { PrismaService } from '../prisma/prisma.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';

const now = new Date('2026-01-01T00:00:00.000Z');

const pendingOrder: Order = {
  id: 1,
  userId: 'test-user-id',
  status: OrderStatus.PENDING,
  subtotal: 100000,
  discountAmount: 0,
  total: 100000,
  createdAt: now,
  updatedAt: now,
  items: [],
};

const orderWithItems: Order = {
  ...pendingOrder,
  items: [
    {
      id: 1,
      orderId: 1,
      productId: '3',
      productName: 'Cà Phê Sữa Đá',
      size: 'M',
      toppings: [],
      qty: 2,
      unitPrice: 40000,
      lineTotal: 80000,
    },
  ],
};

/** Dòng công thức của Cappuccino size M (productId '3') như Prisma trả về. */
const recipe = (ingredientId: number, amount: number) => ({
  productId: '3',
  size: 'M',
  ingredientId,
  amount: new Prisma.Decimal(amount),
});

const storedPayment = {
  id: 1,
  orderId: 1,
  userId: 'test-user-id',
  method: 'momo',
  success: true,
  status: 'PAID',
  amount: 100000,
  requestFingerprint: '1:momo',
  result: { transactionId: 'TXN-MOMO-123456' },
  idempotencyKey: 'idem-1',
  createdAt: now,
};

describe('PaymentsService', () => {
  const orders = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };
  // tx là client nhận bên trong prisma.$transaction callback
  const tx = {
    cup: { updateMany: jest.fn() },
    recipeItem: { findMany: jest.fn() },
    ingredient: { updateMany: jest.fn(), findUnique: jest.fn() },
    payment: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { update: jest.fn() },
    loyaltyTransaction: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    orders.findOne.mockResolvedValue(pendingOrder);
    orders.updateStatus.mockResolvedValue({
      ...pendingOrder,
      status: OrderStatus.PAID,
    });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    tx.cup.updateMany.mockResolvedValue({ count: 1 });
    tx.recipeItem.findMany.mockResolvedValue([]);
    tx.ingredient.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({ loyaltyPoints: 10 }); // số dư SAU khi cộng
    tx.payment.create.mockResolvedValue(storedPayment);
    service = new PaymentsService(
      orders as unknown as OrdersService,
      prisma as unknown as PrismaService,
    );
  });

  it('lưu payment thành công và chuyển đơn sang PAID', async () => {
    const payment = await service.processPayment(1, 'momo', 'idem-1');

    expect(orders.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, tx);
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(payment).toMatchObject({ id: 1, orderId: 1, status: 'PAID' });
    // Đơn 100.000đ → tặng 10 điểm loyalty trong cùng transaction
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user-id' },
      data: { loyaltyPoints: { increment: 10 } },
      select: { loyaltyPoints: true },
    });
    expect(tx.loyaltyTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'test-user-id',
        orderId: 1,
        type: 'EARN',
        points: 10,
        balanceAfter: 10,
      }),
    });
  });

  it('trừ ly và nguyên liệu trong cùng transaction', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.recipeItem.findMany.mockResolvedValue([recipe(1, 18), recipe(2, 80), recipe(3, 15)]);

    await service.processPayment(1, 'momo', 'idem-1');

    // Một truy vấn công thức duy nhất cho cả đơn
    expect(tx.recipeItem.findMany).toHaveBeenCalledTimes(1);
    expect(tx.cup.updateMany).toHaveBeenCalledWith({
      where: { size: 'M', quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: 1, quantity: { gte: new Prisma.Decimal(36) } },
      data: { quantity: { decrement: new Prisma.Decimal(36) } },
    });
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: 2, quantity: { gte: new Prisma.Decimal(160) } },
      data: { quantity: { decrement: new Prisma.Decimal(160) } },
    });
    expect(orders.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, tx);
  });

  it('hết ly đúng size → chặn thanh toán, không ghi payment', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.cup.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('các dòng cùng món/size trong đơn gộp thành một lần trừ mỗi nguyên liệu', async () => {
    const [item] = orderWithItems.items;
    orders.findOne.mockResolvedValue({
      ...orderWithItems,
      items: [item, { ...item, id: 2, qty: 3 }],
    });
    tx.recipeItem.findMany.mockResolvedValue([recipe(2, 80)]);

    await service.processPayment(1, 'momo');

    expect(tx.cup.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.cup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { size: 'M', quantity: { gte: 5 } } }),
    );
    expect(tx.ingredient.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 2, quantity: { gte: new Prisma.Decimal(400) } } }),
    );
  });

  it('hết nguyên liệu → chặn thanh toán', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.recipeItem.findMany.mockResolvedValue([recipe(2, 80)]);
    tx.ingredient.updateMany.mockResolvedValue({ count: 0 });
    tx.ingredient.findUnique.mockResolvedValue({ name: 'Sữa' });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(/Sữa/);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('key đã dùng với cùng nội dung → replay kết quả đã lưu', async () => {
    prisma.payment.findFirst.mockResolvedValue(storedPayment);

    await expect(service.processPayment(1, 'momo', 'idem-1')).resolves.toMatchObject({
      transactionId: 'TXN-MOMO-123456',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('key đã dùng nhưng khác nội dung (method khác) → 400', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...storedPayment,
      requestFingerprint: '1:card',
    });

    await expect(service.processPayment(1, 'momo', 'idem-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('đua cùng key: P2002 → đọc lại payment của bên thắng và replay', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce(null) // pre-check: chưa có
      .mockResolvedValueOnce(storedPayment); // sau P2002: bên thắng đã ghi
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });

    await expect(service.processPayment(1, 'momo', 'idem-1')).resolves.toMatchObject({
      transactionId: 'TXN-MOMO-123456',
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('từ chối thanh toán lần hai cho đơn đã PAID', async () => {
    orders.findOne.mockResolvedValue({ ...pendingOrder, status: OrderStatus.PAID });
    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('đơn không tồn tại → lỗi truyền thẳng 404', async () => {
    orders.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.processPayment(999, 'momo')).rejects.toThrow(NotFoundException);
  });
});
