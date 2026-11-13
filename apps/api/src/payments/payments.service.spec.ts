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
  const prisma = {
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    orders.findOne.mockResolvedValue(pendingOrder);
    orders.updateStatus.mockResolvedValue({ ...pendingOrder, status: 'PAID' });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue(storedPayment);
    service = new PaymentsService(
      orders as unknown as OrdersService,
      prisma as unknown as PrismaService,
    );
  });

  it('persists a successful payment and updates the order status', async () => {
    const payment = await service.processPayment(1, 'momo', 'idem-1');

    expect(orders.updateStatus).toHaveBeenCalledWith(1, 'PAID');
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    expect(payment).toMatchObject({ id: 1, orderId: 1, status: 'SUCCEEDED' });
  });

  it('returns the stored payment for a repeated idempotency key', async () => {
    prisma.payment.findFirst.mockResolvedValue(storedPayment);

    await expect(service.processPayment(1, 'momo', 'idem-1')).resolves.toMatchObject({
      transactionId: 'TXN-MOMO-123456',
    });
    expect(orders.findOne).not.toHaveBeenCalled();
  });

  it('rejects a second payment for an order that is already paid', async () => {
    orders.findOne.mockResolvedValue({ ...pendingOrder, status: 'PAID' });
    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
  });

  it('passes through a missing-order error', async () => {
    orders.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.processPayment(999, 'momo')).rejects.toThrow(NotFoundException);
  });
});
