import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SepayService } from './sepay.service';
import type { OrdersService } from '../orders/orders.service';
import type { PaymentsService } from './payments.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../orders/entities/order.entity';

const ENV = {
  SEPAY_BANK_CODE: 'MB',
  SEPAY_ACCOUNT_NUMBER: '1234567890',
  SEPAY_ACCOUNT_NAME: 'PHUC LONG TEST',
  SEPAY_API_KEY: 'test-api-key',
};

describe('SepayService', () => {
  const saved: Record<string, string | undefined> = {};
  beforeAll(() => {
    for (const key of Object.keys(ENV)) saved[key] = process.env[key];
  });
  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** DB giả trong bộ nhớ: một đơn, tối đa một payment. */
  function setup() {
    const order = {
      id: 17,
      userId: 'user-1',
      status: OrderStatus.PENDING as string,
      total: 120000,
      items: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payment: any = null;
    const tx = {
      order: {
        findUnique: jest.fn(async () => order),
        updateMany: jest.fn(async ({ data }: { data: { status: string } }) => {
          order.status = data.status;
          return { count: 1 };
        }),
      },
      payment: {
        findUnique: jest.fn(async () => payment),
        create: jest.fn(async ({ data }: { data: object }) => {
          payment = { id: 4, createdAt: new Date(), paidAt: null, ...data };
          return payment;
        }),
        update: jest.fn(async ({ data }: { data: object }) => Object.assign(payment, data)),
        updateMany: jest.fn(
          async ({ where, data }: { where: { success: boolean }; data: object }) => {
            if (payment.success !== where.success) return { count: 0 };
            Object.assign(payment, data);
            return { count: 1 };
          },
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
      payment: { findUnique: jest.fn(async () => payment) },
    };
    const orders = { findOne: jest.fn(async () => order) };
    const payments = {
      fulfillOrder: jest.fn(async () => ({ earnedPoints: 12, totalPoints: 17 })),
    };
    const service = new SepayService(
      orders as unknown as OrdersService,
      payments as unknown as PaymentsService,
      prisma as unknown as PrismaService,
    );
    return { service, order, tx, prisma, payments, getPayment: () => payment };
  }

  const event = {
    id: 98231,
    accountNumber: '1234567890',
    transferType: 'in',
    transferAmount: 120000,
    content: 'PHUCLONG-17',
  };

  beforeEach(() => {
    Object.assign(process.env, ENV);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('createCheckout', () => {
    it('mở phiên mới: QR khớp số tiền + nội dung PHUCLONG-<id>, hạn 2 phút', async () => {
      const { service, tx } = setup();

      const checkout = await service.createCheckout('user-1', 17);

      expect(checkout).toMatchObject({
        orderId: 17,
        amount: 120000,
        transferDescription: 'PHUCLONG-17',
        bankCode: 'MB',
        accountNumber: '1234567890',
        status: 'PENDING',
      });
      const qr = new URL(checkout.qrUrl);
      expect(qr.searchParams.get('acc')).toBe('1234567890');
      expect(qr.searchParams.get('amount')).toBe('120000');
      expect(qr.searchParams.get('des')).toBe('PHUCLONG-17');
      const secondsLeft = (Date.parse(checkout.expiresAt) - Date.now()) / 1000;
      expect(secondsLeft).toBeGreaterThan(115);
      expect(secondsLeft).toBeLessThanOrEqual(120);
      expect(tx.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          idempotencyKey: 'sepay-order-17',
          method: 'sepay',
          status: 'PENDING',
        }),
      });
    });

    it('gọi lại khi phiên còn hạn → trả đúng phiên cũ, không tạo thêm', async () => {
      const { service, tx } = setup();
      const first = await service.createCheckout('user-1', 17);
      const again = await service.createCheckout('user-1', 17);

      expect(again.expiresAt).toBe(first.expiresAt);
      expect(tx.payment.create).toHaveBeenCalledTimes(1);
    });

    it('phiên hết hạn: báo EXPIRED và đơn sang PAYMENT_FAILED; restart mở phiên mới', async () => {
      const { service, order, getPayment } = setup();
      await service.createCheckout('user-1', 17);
      getPayment().expiresAt = new Date(Date.now() - 1000);

      const expired = await service.createCheckout('user-1', 17);
      expect(expired.status).toBe('EXPIRED');
      expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
      expect(getPayment().status).toBe('EXPIRED');

      const renewed = await service.createCheckout('user-1', 17, true);
      expect(renewed.status).toBe('PENDING');
      expect(Date.parse(renewed.expiresAt)).toBeGreaterThan(Date.now());
      expect(getPayment().status).toBe('PENDING');
    });

    it('hai request đầu tiên đua nhau: bên thua chạm unique → chạy lại, không lỗi 500', async () => {
      const { service, prisma } = setup();
      const run = prisma.$transaction.getMockImplementation()!;
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' }).mockImplementation(run);

      await expect(service.createCheckout('user-1', 17)).resolves.toMatchObject({
        status: 'PENDING',
      });
    });

    it('chặn: đơn của người khác (404), đơn không còn chờ (409), đã trả (409), thiếu cấu hình (503)', async () => {
      const { service, order, getPayment } = setup();
      await expect(service.createCheckout('hacker', 17)).rejects.toThrow(NotFoundException);

      order.status = OrderStatus.CANCELLED;
      await expect(service.createCheckout('user-1', 17)).rejects.toThrow(ConflictException);

      order.status = OrderStatus.PENDING;
      await service.createCheckout('user-1', 17);
      getPayment().success = true;
      await expect(service.createCheckout('user-1', 17)).rejects.toThrow(/đã được thanh toán/);

      delete process.env.SEPAY_ACCOUNT_NAME;
      await expect(service.createCheckout('user-1', 17)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('khớp đủ điều kiện → hoàn tất đơn (trừ kho, PAID, cộng điểm) trong transaction; webhook trùng → duplicate', async () => {
      const { service, tx, payments, getPayment } = setup();
      await service.createCheckout('user-1', 17);

      await expect(service.handleWebhook(event)).resolves.toEqual({ accepted: true });
      await expect(service.handleWebhook(event)).resolves.toEqual({
        accepted: true,
        duplicate: true,
      });

      expect(payments.fulfillOrder).toHaveBeenCalledTimes(1);
      expect(payments.fulfillOrder).toHaveBeenCalledWith(tx, expect.objectContaining({ id: 17 }));
      expect(getPayment()).toMatchObject({
        success: true,
        status: 'PAID',
        result: expect.objectContaining({
          sepayTransactionId: '98231',
          transactionId: 'TXN-SEPAY-98231',
          earnedLoyaltyPoints: 12,
          totalLoyaltyPoints: 17,
        }),
      });
    });

    it('đã PAID bằng giao dịch khác → 409, không hoàn tất lần hai', async () => {
      const { service, payments } = setup();
      await service.createCheckout('user-1', 17);
      await service.handleWebhook(event);

      await expect(service.handleWebhook({ ...event, id: 98232 })).rejects.toThrow(
        ConflictException,
      );
      expect(payments.fulfillOrder).toHaveBeenCalledTimes(1);
    });

    it('hai webhook song song: bên claim thua nhận ra giao dịch trùng và không hoàn tất', async () => {
      const { service, tx, payments } = setup();
      await service.createCheckout('user-1', 17);
      // Bên kia claim xong ngay sau bước kiểm tra: updateMany thấy success đã true
      tx.payment.updateMany.mockImplementationOnce(async () => {
        Object.assign((await tx.payment.findUnique()) as object, {
          success: true,
          result: { sepayTransactionId: '98231' },
        });
        return { count: 0 };
      });

      await expect(service.handleWebhook(event)).resolves.toEqual({
        accepted: true,
        duplicate: true,
      });
      expect(payments.fulfillOrder).not.toHaveBeenCalled();
    });

    it.each([
      ['PHUCLONG-17', 17],
      ['phuclong17', 17],
      ['MBVCB.5551.PHUCLONG17.CT tu 0123', 17],
    ])('nhận nội dung chuyển khoản %j', async (content) => {
      const { service, payments } = setup();
      await service.createCheckout('user-1', 17);

      await service.handleWebhook({ ...event, content });
      expect(payments.fulfillOrder).toHaveBeenCalledTimes(1);
    });

    it('tìm mã đơn cả ở trường description', async () => {
      const { service, payments } = setup();
      await service.createCheckout('user-1', 17);

      await service.handleWebhook({ ...event, content: 'abc', description: 'PHUCLONG-17' });
      expect(payments.fulfillOrder).toHaveBeenCalledTimes(1);
    });

    describe('từ chối bằng 4xx và giữ nguyên đơn', () => {
      async function rejected(
        patch: Record<string, unknown>,
        error: new (...a: never[]) => Error,
        arrange?: (ctx: ReturnType<typeof setup>) => void,
      ) {
        const ctx = setup();
        await ctx.service.createCheckout('user-1', 17);
        arrange?.(ctx);
        await expect(ctx.service.handleWebhook({ ...event, ...patch })).rejects.toThrow(error);
        expect(ctx.payments.fulfillOrder).not.toHaveBeenCalled();
        expect(ctx.getPayment().success).toBe(false);
      }

      it('không phải tiền vào', () => rejected({ transferType: 'out' }, BadRequestException));
      it('sai tài khoản nhận', () => rejected({ accountNumber: '999' }, BadRequestException));
      it('nội dung không có mã đơn', () => rejected({ content: 'ck tien' }, BadRequestException));
      it('thiếu số tiền', () => rejected({ transferAmount: undefined }, BadRequestException));
      it('chuyển thiếu tiền', () => rejected({ transferAmount: 50000 }, BadRequestException));
      it('chuyển dư tiền (phải khớp đúng)', () =>
        rejected({ transferAmount: 130000 }, BadRequestException));
      it('đơn chưa có phiên SePay', async () => {
        const { service, payments } = setup();
        await expect(service.handleWebhook(event)).rejects.toThrow(BadRequestException);
        expect(payments.fulfillOrder).not.toHaveBeenCalled();
      });
      it('phiên đã hết hạn', () =>
        rejected({}, ConflictException, ({ getPayment }) => {
          getPayment().expiresAt = new Date(Date.now() - 1000);
        }));
      it('đơn đã bị hủy', () =>
        rejected({}, ConflictException, ({ order }) => {
          order.status = OrderStatus.CANCELLED;
        }));
    });

    it('thiếu cấu hình SePay → 503', async () => {
      const { service } = setup();
      delete process.env.SEPAY_ACCOUNT_NUMBER;
      await expect(service.handleWebhook(event)).rejects.toThrow(ServiceUnavailableException);
    });

    it('hoàn tất đơn lỗi (hết ly/nguyên liệu) → ném tiếp để transaction rollback và SePay retry', async () => {
      const { service, payments } = setup();
      await service.createCheckout('user-1', 17);
      payments.fulfillOrder.mockRejectedValue(new BadRequestException('Hết ly size S'));

      await expect(service.handleWebhook(event)).rejects.toThrow('Hết ly size S');
    });
  });

  describe('simulate (demo local)', () => {
    it('đi qua webhook và hoàn tất đơn', async () => {
      const { service, payments } = setup();
      await service.createCheckout('user-1', 17);

      await expect(
        service.simulate(17, { id: 'user-1', role: 'CUSTOMER' } as never),
      ).resolves.toEqual({ success: true });
      expect(payments.fulfillOrder).toHaveBeenCalledTimes(1);
    });

    it('bị chặn khi NODE_ENV=production', async () => {
      const { service, payments } = setup();
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.simulate(17, { id: 'user-1' } as never)).rejects.toThrow(
          ForbiddenException,
        );
        expect(payments.fulfillOrder).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    it('chưa có phiên SePay → 400', async () => {
      const { service } = setup();
      await expect(service.simulate(17, { id: 'user-1' } as never)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
