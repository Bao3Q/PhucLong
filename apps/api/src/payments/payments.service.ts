import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Prisma, ProductSize } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/orders.data';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentRecord,
  SePaySession,
  SePayWebhookPayload,
} from './payments.data';

/** Hạn chót của phiên thanh toán SePay (giây) — đề bài yêu cầu 2 phút. */
const SEPAY_TIMEOUT_SECONDS = Number(process.env.SEPAY_TIMEOUT_SECONDS || 120);

/** So sánh Authorization header với khóa webhook mà không rò rỉ thời gian. */
function authKeyMatches(header: string, expected: string): boolean {
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** result là Json của Prisma — luôn đưa về object để ghi đè an toàn. */
function asRecord(result: unknown): Record<string, unknown> {
  return typeof result === 'object' && result !== null
    ? { ...result }
    : {};
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  async processPayment(
    orderId: string | number,
    method: 'momo' | 'card',
    idempotencyKey?: string,
  ): Promise<PaymentRecord> {

    if (idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { idempotencyKey },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return this.toPaymentRecord(existing);
      }
    }


    const order = await this.ordersService.findOne(orderId);

    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó.');
    }


    const transactionId = `TXN-${(method || 'CARD').toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Trừ kho + đổi trạng thái đơn + ghi nhận thanh toán trong một transaction:
    // thiếu nguyên liệu/ly ở bất kỳ bước nào thì tất cả được rollback.
    const payment = await this.prisma.$transaction(async (tx) => {
      await this.deductInventory(tx, order);

      const paidOrder = await this.ordersService.updateStatus(order.id, 'PAID', tx);

      return tx.payment.create({
        data: {
          userId: paidOrder.userId,
          orderId: paidOrder.id,
          method: method || 'card',
          success: true,
          idempotencyKey,
          requestFingerprint: `${paidOrder.id}:${method || 'card'}`,
          result: { transactionId, status: 'SUCCEEDED' },
          amount: paidOrder.totalAmount,
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    });

    return this.toPaymentRecord(payment);
  }

  /**
   * Trừ kho nguyên liệu (theo công thức) và ly (theo size) cho đơn hàng.
   * Cập nhật có điều kiện (quantity >= lượng cần trừ): nếu không đủ thì throw
   * BadRequestException để rollback toàn bộ transaction — kho không bao giờ âm.
   * Món chưa có công thức thì bỏ qua trừ nguyên liệu (vẫn trừ ly).
   */
  private async deductInventory(
    tx: Prisma.TransactionClient,
    order: Order,
  ): Promise<void> {
    // Gom nhu cầu theo cặp (productId, size) vì các món trùng sẽ trừ chung
    const needs = new Map<string, { productId: string; size: ProductSize; qty: number }>();
    for (const item of order.items) {
      const key = `${item.productId}:${item.size}`;
      const existing = needs.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        needs.set(key, {
          productId: String(item.productId),
          size: item.size as ProductSize,
          qty: item.quantity,
        });
      }
    }

    for (const need of needs.values()) {
      const cup = await tx.cup.updateMany({
        where: { size: need.size, quantity: { gte: need.qty } },
        data: { quantity: { decrement: need.qty } },
      });
      if (cup.count === 0) {
        throw new BadRequestException(
          `Hết ly size ${need.size}, không thể xử lý thanh toán cho đơn hàng này.`,
        );
      }

      const recipes = await tx.recipeItem.findMany({
        where: { productId: need.productId, size: need.size },
        include: { ingredient: true },
      });
      for (const recipe of recipes) {
        const amount = recipe.amount.mul(need.qty);
        const ingredient = await tx.ingredient.updateMany({
          where: { id: recipe.ingredientId, quantity: { gte: amount } },
          data: { quantity: { decrement: amount } },
        });
        if (ingredient.count === 0) {
          throw new BadRequestException(
            `Nguyên liệu "${recipe.ingredient.name}" không đủ số lượng, không thể xử lý thanh toán cho đơn hàng này.`,
          );
        }
      }
    }
  }

  /**
   * Tạo phiên thanh toán SePay cho đơn: ghi nhận payment PENDING với mã
   * chuyển khoản ngẫu nhiên và hạn chót (2 phút), trả về URL ảnh QR để quét.
   */
  async createSePayPayment(
    orderId: string | number,
    user?: AuthUser,
  ): Promise<SePaySession> {
    const acc = process.env.SEPAY_ACC;
    const bank = process.env.SEPAY_BANK;
    if (!acc || !bank) {
      throw new BadRequestException(
        'Chưa cấu hình tài khoản nhận tiền (SEPAY_ACC, SEPAY_BANK) cho SePay.',
      );
    }

    const order = await this.ordersService.findOne(orderId, user);
    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó.');
    }

    // Mã chuyển khoản ngẫu nhiên: nội dung chuyển khoản chứa mã này để
    // webhook khớp về đúng đơn, không dùng số tuần tự để tránh bị dò.
    const paymentCode = `PL${randomBytes(5).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + SEPAY_TIMEOUT_SECONDS * 1000);

    await this.prisma.payment.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        method: 'sepay',
        success: false,
        requestFingerprint: `sepay:${order.id}:${paymentCode}`,
        result: { status: 'PENDING', paymentCode },
        amount: order.totalAmount,
        status: 'PENDING',
        paymentCode,
        expiresAt,
      },
    });

    const qrBase = process.env.SEPAY_QR_BASE || 'https://vietqr.app/img';
    const qrUrl =
      `${qrBase}?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}` +
      `&amount=${order.totalAmount}&des=${paymentCode}`;

    return {
      orderId: order.id,
      paymentCode,
      qrUrl,
      amount: order.totalAmount,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Webhook SePay gọi khi tài khoản nhận tiền có biến động.
   * Điều kiện response: HTTP 200 + body {"success": true} trong 30s,
   * nên mọi nhánh nghiệp vụ đều trả success:true, chỉ sai khóa API mới 401
   * (SePay sẽ tự retry nếu nhận khác).
   */
  async handleWebhook(
    authHeader: string | undefined,
    payload: SePayWebhookPayload,
  ): Promise<{ success: true }> {
    const apiKey = process.env.SEPAY_API_KEY;
    if (!apiKey || !authHeader || !authKeyMatches(authHeader, `Apikey ${apiKey}`)) {
      throw new UnauthorizedException('Webhook SePay: khóa API không hợp lệ');
    }

    // Chỉ quan tâm tiền VÀO tài khoản.
    if (payload.transferType !== 'in') {
      return { success: true };
    }

    const paymentCode = this.extractPaymentCode(payload);
    if (!paymentCode) {
      return { success: true }; // chuyển khoản lạ, không thuộc đơn nào
    }

    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode },
    });
    if (!payment || payment.status !== 'PENDING') {
      return { success: true }; // không tồn tại hoặc đã xử lý (webhook trùng)
    }

    const expired = !!payment.expiresAt && payment.expiresAt.getTime() < Date.now();
    const underpaid =
      typeof payload.transferAmount === 'number' && payload.transferAmount < payment.amount;

    if (expired || underpaid) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: expired ? 'EXPIRED' : 'FAILED',
          result: {
            ...asRecord(payment.result),
            status: expired ? 'EXPIRED' : 'FAILED',
            sepayTransactionId: payload.id ?? null,
            reason: expired
              ? 'Hết thời hạn thanh toán 2 phút'
              : 'Số tiền chuyển khoản nhỏ hơn số tiền cần thanh toán',
          },
        },
      });
      return { success: true };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Chiếm quyền xử lý bằng update có điều kiện: nếu webhook trùng chạy
        // song song thì chỉ một bên claim thành công (count > 0).
        const claim = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: {
            status: 'PAID',
            success: true,
            paidAt: new Date(),
            result: {
              ...asRecord(payment.result),
              status: 'PAID',
              transactionId: `TXN-SEPAY-${payload.id ?? Date.now()}`,
              sepayReferenceCode: payload.referenceCode ?? null,
            },
          },
        });
        if (claim.count === 0) {
          return; // đã có webhook khác xử lý
        }

        const order = await this.ordersService.findOne(payment.orderId);
        if (order.status === 'PAID') {
          // Đơn đã được trả bằng luồng khác (momo/card) — không hoàn tất lại.
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED', result: { ...asRecord(payment.result), status: 'FAILED', reason: 'Đơn hàng đã được thanh toán' } },
          });
          return;
        }

        // Trừ kho + đổi trạng thái đơn trong cùng transaction với claim:
        // hết nguyên liệu/ly thì toàn bộ rollback, phiên vẫn PENDING.
        await this.deductInventory(tx, order);
        await this.ordersService.updateStatus(order.id, 'PAID', tx);
      });
    } catch (error) {
      // Tiền đã vào nhưng không fulfill được → đánh dấu FAILED để tránh retry vô ích.
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PAID' },
        data: { status: 'FAILED', success: false },
      });
      throw error;
    }

    return { success: true };
  }

  /** Khớp mã thanh toán từ trường `code` hoặc nội dung chuyển khoản. */
  private extractPaymentCode(payload: SePayWebhookPayload): string | null {
    const raw = `${payload.code ?? ''} ${payload.content ?? ''}`.toUpperCase();
    const match = raw.match(/PL[0-9A-F]{10}/);
    return match ? match[0] : null;
  }

  async getByOrderId(
    orderId: string | number,
    user?: AuthUser,
  ): Promise<PaymentRecord | undefined> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: Number(orderId) },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      return undefined;
    }
    if (user && user.role !== 'ADMIN' && payment.userId !== user.id) {
      throw new ForbiddenException('Chỉ được xem thanh toán của đơn hàng của mình');
    }

    // Hết hạn "lười": phiên SePay quá hạn chưa trả → chuyển EXPIRED khi được hỏi.
    if (
      payment.status === 'PENDING' &&
      payment.expiresAt &&
      payment.expiresAt.getTime() < Date.now()
    ) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'EXPIRED',
          result: { ...asRecord(payment.result), status: 'EXPIRED' },
        },
      });
      payment.status = 'EXPIRED';
    }

    return this.toPaymentRecord(payment);
  }

  private toPaymentRecord(payment: {
    id: number;
    orderId: number;
    method: string;
    amount: number;
    success: boolean;
    status?: string;
    result: unknown;
    idempotencyKey: string | null;
    createdAt: Date;
    expiresAt?: Date | null;
    paymentCode?: string | null;
  }): PaymentRecord {
    const result = (payment.result ?? {}) as { transactionId?: string };
    const status = (payment.status as PaymentRecord['status']) ??
      (payment.success ? 'PAID' : 'FAILED');
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method as 'momo' | 'card' | 'sepay',
      amount: payment.amount,
      status,
      transactionId: result.transactionId ?? `TXN-${payment.id}`,
      idempotencyKey: payment.idempotencyKey ?? undefined,
      createdAt: payment.createdAt.toISOString(),
      expiresAt: payment.expiresAt?.toISOString() ?? undefined,
      paymentCode: payment.paymentCode ?? undefined,
    };
  }
}
