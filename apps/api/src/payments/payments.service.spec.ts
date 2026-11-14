import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
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
    ingredient: { updateMany: jest.fn() },
    payment: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
  });

  it('trừ ly và nguyên liệu trong cùng transaction', async () => {
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
    expect(orders.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, tx);
  });

  it('hết ly đúng size → chặn thanh toán, không ghi payment', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.cup.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
    expect(orders.updateStatus).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('hết nguyên liệu → chặn thanh toán', async () => {
    orders.findOne.mockResolvedValue(orderWithItems);
    tx.recipeItem.findMany.mockResolvedValue([
      { ingredientId: 2, amount: { mul: (n: number) => 80 * n }, ingredient: { name: 'Sữa' } },
    ]);
    tx.ingredient.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayment(1, 'card')).rejects.toThrow(BadRequestException);
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

  describe('SePay (chuyển khoản QR, hết hạn 2 phút)', () => {
    const sepayPayment = {
      id: 10,
      orderId: 1,
      userId: 'test-user-id',
      method: 'sepay',
      success: false,
      status: 'PENDING',
      paymentCode: 'PLABCDEF1234',
      amount: 100000,
      result: { status: 'PENDING', paymentCode: 'PLABCDEF1234' },
      idempotencyKey: null,
      createdAt: new Date('2026-11-14T00:00:00.000Z'),
      expiresAt: new Date(Date.now() + 60_000), // còn hạn
    };

    beforeAll(() => {
      process.env.SEPAY_ACC = '0010000000355';
      process.env.SEPAY_BANK = 'Vietcombank';
      process.env.SEPAY_API_KEY = 'sepay-secret';
    });
    afterAll(() => {
      delete process.env.SEPAY_ACC;
      delete process.env.SEPAY_BANK;
      delete process.env.SEPAY_API_KEY;
    });

    it('tạo phiên PENDING với QR, mã chuyển khoản và hạn chót đúng 2 phút', async () => {
      prisma.payment.create.mockResolvedValue(sepayPayment);

      const session = await service.createSePayPayment(1);

      expect(session).toMatchObject({ orderId: 1, amount: 100000 });
      expect(session.paymentCode).toMatch(/^PL[0-9A-F]{10}$/);
      expect(session.qrUrl).toContain('bank=Vietcombank');
      expect(session.qrUrl).toContain('amount=100000');
      expect(session.qrUrl).toContain(`des=${session.paymentCode}`);
      const secondsLeft = (new Date(session.expiresAt).getTime() - Date.now()) / 1000;
      expect(secondsLeft).toBeGreaterThan(115);
      expect(secondsLeft).toBeLessThanOrEqual(120);
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'sepay',
          status: 'PENDING',
          paymentCode: session.paymentCode,
        }),
      });
    });

    it('chưa cấu hình tài khoản nhận tiền → 400', async () => {
      const acc = process.env.SEPAY_ACC;
      delete process.env.SEPAY_ACC;
      await expect(service.createSePayPayment(1)).rejects.toThrow(BadRequestException);
      process.env.SEPAY_ACC = acc;
    });

    it('webhook đủ tiền trong hạn → trừ kho và hoàn tất đơn', async () => {
      prisma.payment.findUnique.mockResolvedValue(sepayPayment);
      tx.payment.updateMany.mockResolvedValue({ count: 1 }); // claim thành công
      orders.findOne.mockResolvedValue(orderWithItems);

      const res = await service.handleWebhook({
        id: 92704,
        code: 'PLABCDEF1234',
        transferType: 'in',
        transferAmount: 100000,
        referenceCode: 'FT24012345678',
      });

      expect(res).toEqual({ success: true });
      expect(tx.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10, status: 'PENDING' } }),
      );
      expect(tx.cup.updateMany).toHaveBeenCalled();
      expect(orders.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, tx);
    });

    it('webhook chuyển khoản lạ (không khớp mã) → bỏ qua an toàn', async () => {
      const res = await service.handleWebhook({
        id: 1,
        content: 'chuyen khoan la',
        transferType: 'in',
        transferAmount: 100000,
      });
      expect(res).toEqual({ success: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('webhook nhận tiền sau hạn 2 phút → EXPIRED, không hoàn tất đơn', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...sepayPayment,
        expiresAt: new Date(Date.now() - 1000),
      });
      prisma.payment.update.mockResolvedValue(sepayPayment);

      const res = await service.handleWebhook({
        id: 92705,
        code: 'PLABCDEF1234',
        transferType: 'in',
        transferAmount: 100000,
      });

      expect(res).toEqual({ success: true });
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({ status: 'EXPIRED' }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(orders.updateStatus).not.toHaveBeenCalled();
    });

    it('webhook nhận thiếu tiền → FAILED', async () => {
      prisma.payment.findUnique.mockResolvedValue(sepayPayment);
      prisma.payment.update.mockResolvedValue(sepayPayment);

      await service.handleWebhook({
        id: 92706,
        code: 'PLABCDEF1234',
        transferType: 'in',
        transferAmount: 50000,
      });

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('poll tra phiên đã quá hạn → EXPIRED (hết hạn lười)', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...sepayPayment,
        expiresAt: new Date(Date.now() - 1000),
      });
      prisma.payment.update.mockResolvedValue(sepayPayment);

      const record = await service.getByOrderId(1);

      expect(record).toMatchObject({ status: 'EXPIRED', paymentCode: 'PLABCDEF1234' });
      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('mô phỏng chuyển khoản (demo) đi qua webhook → hoàn tất đơn', async () => {
      prisma.payment.findFirst.mockResolvedValue(sepayPayment);
      tx.payment.updateMany.mockResolvedValue({ count: 1 });
      orders.findOne.mockResolvedValue(orderWithItems);

      const res = await service.simulateSePayPayment(1);

      expect(res).toEqual({ success: true });
      expect(tx.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 10, status: 'PENDING' } }),
      );
      expect(orders.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, tx);
    });

    it('mô phỏng bị chặn khi NODE_ENV=production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.simulateSePayPayment(1)).rejects.toThrow(ForbiddenException);
        expect(prisma.payment.findFirst).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    it('mô phỏng khi không còn phiên PENDING → 400', async () => {
      orders.findOne.mockResolvedValue(pendingOrder);
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.simulateSePayPayment(1)).rejects.toThrow(BadRequestException);
    });
  });
});
