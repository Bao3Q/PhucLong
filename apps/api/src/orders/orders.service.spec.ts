import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { AuthUser } from '../common/auth/auth-user.interface';
import type { PrismaService } from '../prisma/prisma.service';

const user: AuthUser = {
  id: 'test-user-id',
  email: 'customer@example.com',
  role: 'CUSTOMER',
};

const storedOrder = {
  id: 1,
  userId: user.id,
  total: 100000,
  status: 'PENDING',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  items: [
    {
      productId: '1',
      productName: 'Trà Sữa Phúc Long',
      size: 'M',
      toppings: [],
      note: null,
      qty: 2,
      unitPrice: 50000,
    },
  ],
};

describe('OrdersService', () => {
  let service: OrdersService;
  const prisma = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma as unknown as PrismaService);
  });

  it('persists an order and its items through Prisma', async () => {
    prisma.order.create.mockResolvedValue(storedOrder);

    const order = await service.createOrder(user, [
      {
        productId: 1,
        productName: 'Trà Sữa Phúc Long',
        size: 'M',
        quantity: 2,
        unitPrice: 50000,
      },
    ]);

    expect(prisma.order.create).toHaveBeenCalledTimes(1);
    expect(order).toMatchObject({
      id: 1,
      userId: user.id,
      totalAmount: 100000,
      status: 'PENDING_PAYMENT',
    });
  });

  it('rejects an empty order before writing to the database', async () => {
    await expect(service.createOrder(user, [])).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('loads an order from Prisma', async () => {
    prisma.order.findUnique.mockResolvedValue(storedOrder);

    await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { items: true },
    });
  });

  it('throws when the requested order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('chủ đơn được xem đơn của mình', async () => {
    prisma.order.findUnique.mockResolvedValue(storedOrder);
    await expect(service.findOne(1, user)).resolves.toMatchObject({ id: 1 });
  });

  it('user khác xem đơn của người khác → Forbidden', async () => {
    prisma.order.findUnique.mockResolvedValue(storedOrder);
    const stranger: AuthUser = { id: 'other-user-id', role: 'CUSTOMER' };
    await expect(service.findOne(1, stranger)).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN được xem đơn của bất kỳ ai', async () => {
    prisma.order.findUnique.mockResolvedValue(storedOrder);
    const admin: AuthUser = { id: 'admin-id', role: 'ADMIN' };
    await expect(service.findOne(1, admin)).resolves.toMatchObject({ id: 1 });
  });
});
