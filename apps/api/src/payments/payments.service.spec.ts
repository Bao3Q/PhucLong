import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import type { OrdersService } from '../orders/orders.service';
import type { PrismaService } from '../prisma/prisma.service';

const pendingOrder = {
  id: 1,
  userId: 'test-user-id',
  totalAmount: 100000,
  status: 'PENDING_PAYMENT' as const,
  createdAt: new Date().toISOString(),
  items: [],
};

const orderWithItems = {
  ...pendingOrder,
  items: [
    {
      productId: 3,
      productName: 'Cà Phê Sữa Đá',
      size: 'M' as const,
      quantity: 2,
      unitPrice: 40000,
    },
  ],
};

const storedPayment = {
  id: 1,
  orderId: 1,
  method: 'momo',
  amount: 100000,
  result: { transactionId: 'TXN-MOMO-123456' },
  idempotencyKey: 'idem-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
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
    ingredient: { updateMany: jest.fn() },
    payment: { create: jest.fn() },
  };
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    orders.findOne.mockResolvedValue(pendingOrder);
    orders.updateStatus.mockResolvedValue({ ...pendingOrder, status: 'PAID' });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
    tx.cup.updateMany.mockResolvedValue({ count: 1 });
    tx.recipeItem.findMany.mockResolvedValue([]);
    tx.ingredient.updateMany.mockResolvedValue({ count: 1 });
    tx.payment.create.mockResolvedValue(storedPayment);
    service = new PaymentsService(
      orders as unknown as OrdersService,
      prisma as unknown as PrismaService,
    );
  });

  it('persists a successful payment and updates the order status', async () => {
    const payment = await service.processPayment(1, 'momo', 'idem-1');

    expect(orders.updateStatus).toHaveBeenCalledWith(1, 'PAID', tx);
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(payment).toMatchObject({ id: 1, orderId: 1, status: 'SUCCEEDED' });
  });

  it('deducts cups and ingredients inside the same transaction', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.recipeItem.findMany.mockResolvedValue([
      { ingredientId: 1, amount: { mul: (n: number) => 18 * n }, ingredient: { name: 'Cà phê' } },
      { ingredientId: 2, amount: { mul: (n: number) => 80 * n }, ingredient: { name: 'Sữa' } },
      { ingredientId: 3, amount: { mul: (n: number) => 15 * n }, ingredient: { name: 'Đường' } },
    ]);

    await service.processPayment(1, 'momo', 'idem-1');

    expect(tx.cup.updateMany).toHaveBeenCalledWith({
      where: { size: 'M', quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: 1, quantity: { gte: 36 } },
      data: { quantity: { decrement: 36 } },
    });
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: 2, quantity: { gte: 160 } },
      data: { quantity: { decrement: 160 } },
    });
    expect(orders.updateStatus).toHaveBeenCalledWith(1, 'PAID', tx);
  });

  it('rejects payment when cups of the requested size run out', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.cup.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('rejects payment when an ingredient runs out', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.recipeItem.findMany.mockResolvedValue([
      { ingredientId: 2, amount: { mul: (n: number) => 80 * n }, ingredient: { name: 'Sữa' } },
    ]);
    tx.ingredient.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('returns the stored payment for a repeated idempotency key', async () => {
    prisma.payment.findFirst.mockResolvedValue(storedPayment);

    await expect(service.processPayment(1, 'momo', 'idem-1')).resolves.toMatchObject({
      transactionId: 'TXN-MOMO-123456',
    });
    expect(orders.findOne).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a second payment for an order that is already paid', async () => {
    orders.findOne.mockResolvedValue({ ...pendingOrder, status: 'PAID' });
    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('passes through a missing-order error', async () => {
    orders.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.processPayment(999, 'momo')).rejects.toThrow(NotFoundException);
  });
});
