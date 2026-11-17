import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { LoyaltyTransactionType, Prisma, ProductSize } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaymentRecord,
  PaymentStatus,
  SePaySession,
  SePayWebhookPayload,
} from './payments.data';

/** Hạn chót của phiên thanh toán SePay (giây) — đề bài yêu cầu 2 phút. */
const SEPAY_TIMEOUT_SECONDS = Number(process.env.SEPAY_TIMEOUT_SECONDS || 120);

/** Cứ mỗi 10.000đ được thanh toán thành công thì tặng 1 điểm loyalty. */
const LOYALTY_EARN_UNIT = 10_000;

/** result là Json của Prisma — luôn đưa về object để ghi đè an toàn. */
function asRecord(result: unknown): Record<string, unknown> {
  return typeof result === 'object' && result !== null
    ? { ...result }
    : {};
}

/** Nhận diện lỗi unique constraint của Prisma (trùng khóa idempotency). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
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
    user?: AuthUser,
  ): Promise<PaymentRecord> {
    // Có user (route có JWT) → chỉ chủ đơn hoặc ADMIN được thanh toán.
    const order = await this.ordersService.findOne(orderId, user);

    const payMethod = method || 'card';
    // Vân tay nội dung: cùng key nhưng khác nội dung (đơn/method) là bị cấm.
    const requestFingerprint = `${order.id}:${payMethod}`;

    // Replay phải đứng TRƯỚC mọi chặn nghiệp vụ: client retry sau timeout
    // (khi đơn đã PAID) vẫn phải nhận lại kết quả đã lưu chứ không phải lỗi.
    if (idempotencyKey) {
      const replay = await this.findReplay(order.userId, idempotencyKey, requestFingerprint);
      if (replay) return replay;
    }

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó.');
    }

    const transactionId = `TXN-${payMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    try {
      // Trừ kho + đổi trạng thái đơn + ghi nhận thanh toán trong một transaction:
      // thiếu nguyên liệu/ly ở bất kỳ bước nào thì tất cả được rollback.
      const payment = await this.prisma.$transaction(async (tx) => {
        await this.deductInventory(tx, order);
        await this.ordersService.updateStatus(order.id, OrderStatus.PAID, tx);
        await this.awardLoyaltyPoints(tx, order.userId, order.id, order.total);

        return tx.payment.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            method: payMethod,
            success: true,
            idempotencyKey,
            requestFingerprint,
            result: { transactionId, status: 'SUCCEEDED' },
            amount: order.total,
            status: 'PAID',
            paidAt: new Date(),
          },
        });
      });
      return this.toPaymentRecord(payment);
    } catch (error) {
      // Hai request dùng chung key chạm vạch đua: unique (userId, idempotencyKey)
      // chặn bên thứ hai — replay kết quả của bên đã ghi thay vì lỗi 500.
      if (idempotencyKey && isUniqueViolation(error)) {
        const replay = await this.findReplay(order.userId, idempotencyKey, requestFingerprint);
        if (replay) return replay;
      }
      throw error;
    }
  }

  /**
   * Payment đã lưu cho (user, idempotencyKey): cùng nội dung → trả lại để replay,
   * khác nội dung → 400, chưa có → null. (userId, idempotencyKey) là unique nên
   * tối đa một dòng.
   */
  private async findReplay(
    userId: string,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<PaymentRecord | null> {
    const existing = await this.prisma.payment.findFirst({
      where: { userId, idempotencyKey },
    });
    if (!existing) return null;
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new BadRequestException(
        'Idempotency-Key đã được dùng cho một yêu cầu khác, vui lòng dùng khóa mới.',
      );
    }
    return this.toPaymentRecord(existing);
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
    // Gom nhu cầu: ly theo size, công thức theo (productId, size) — các món
    // trùng trừ chung để số truy vấn không tăng theo số dòng trong đơn.
    const cups = new Map<ProductSize, number>();
    const variants = new Map<string, { productId: string; size: ProductSize; qty: number }>();
    for (const item of order.items) {
      cups.set(item.size, (cups.get(item.size) ?? 0) + item.qty);
      const key = `${item.productId}:${item.size}`;
      const variant = variants.get(key);
      if (variant) {
        variant.qty += item.qty;
      } else {
        variants.set(key, { productId: item.productId, size: item.size, qty: item.qty });
      }
    }

    // Một truy vấn lấy công thức của mọi món, rồi cộng dồn theo nguyên liệu.
    const recipes = await tx.recipeItem.findMany({
      where: {
        OR: [...variants.values()].map(({ productId, size }) => ({ productId, size })),
      },
    });
    const ingredients = new Map<number, Prisma.Decimal>();
    for (const recipe of recipes) {
      const { qty } = variants.get(`${recipe.productId}:${recipe.size}`)!;
      ingredients.set(
        recipe.ingredientId,
        (ingredients.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).add(
          recipe.amount.mul(qty),
        ),
      );
    }

    // Trừ theo thứ tự cố định để hai thanh toán song song không khóa chéo nhau.
    for (const [size, qty] of [...cups].sort(([a], [b]) => a.localeCompare(b))) {
      const cup = await tx.cup.updateMany({
        where: { size, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (cup.count === 0) {
        throw new BadRequestException(
          `Hết ly size ${size}, không thể xử lý thanh toán cho đơn hàng này.`,
        );
      }
    }
    for (const [id, amount] of [...ingredients].sort(([a], [b]) => a - b)) {
      const ingredient = await tx.ingredient.updateMany({
        where: { id, quantity: { gte: amount } },
        data: { quantity: { decrement: amount } },
      });
      if (ingredient.count === 0) {
        // Chỉ tra tên khi lỗi — đường thành công không cần.
        const found = await tx.ingredient.findUnique({ where: { id }, select: { name: true } });
        throw new BadRequestException(
          `Nguyên liệu "${found?.name ?? id}" không đủ số lượng, không thể xử lý thanh toán cho đơn hàng này.`,
        );
      }
    }
  }

  /**
   * Cộng điểm loyalty cho đơn vừa thanh toán thành công (1 điểm/10.000đ) và
   * ghi dòng LoyaltyTransaction EARN. Chạy trong cùng transaction với payment
   * nên lỗi ở đây cũng rollback toàn bộ thanh toán.
   */
  private async awardLoyaltyPoints(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: number,
    total: number,
  ): Promise<void> {
    const points = Math.floor(total / LOYALTY_EARN_UNIT);
    if (points <= 0) return;

    // increment nguyên tử và trả luôn số dư mới: không cần đọc trước (và
    // balanceAfter đúng cả khi hai đơn của cùng user thanh toán song song).
    const { loyaltyPoints } = await tx.user.update({
      where: { id: userId },
      data: { loyaltyPoints: { increment: points } },
      select: { loyaltyPoints: true },
    });
    await tx.loyaltyTransaction.create({
      data: {
        userId,
        orderId,
        type: LoyaltyTransactionType.EARN,
        points,
        balanceAfter: loyaltyPoints,
        description: `Tích điểm từ đơn #${orderId}`,
      },
    });
  }

  /** GET /payments/loyalty — điểm thưởng hiện tại của user đang đăng nhập. */
  async getLoyaltyPoints(
    user: AuthUser,
  ): Promise<{ userId: string; loyaltyPoints: number }> {
    const found = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!found) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return { userId: found.id, loyaltyPoints: found.loyaltyPoints };
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
    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó.');
    }

    // Mã chuyển khoản ngẫu nhiên: nội dung chuyển khoản chứa mã này để
    // webhook khớp về đúng đơn, không dùng số tuần tự để tránh bị dò.
    const paymentCode = `PL${randomBytes(5).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + SEPAY_TIMEOUT_SECONDS * 1000);

    const qrBase = process.env.SEPAY_QR_BASE || 'https://vietqr.app/img';
    const qrUrl =
      `${qrBase}?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}` +
      `&amount=${order.total}&des=${paymentCode}`;

    await this.prisma.payment.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        method: 'sepay',
        success: false,
        requestFingerprint: `sepay:${order.id}:${paymentCode}`,
        result: { status: 'PENDING', paymentCode, qrUrl },
        amount: order.total,
        status: 'PENDING',
        paymentCode,
        expiresAt,
      },
    });

    return {
      orderId: order.id,
      paymentCode,
      qrUrl,
      amount: order.total,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Webhook SePay gọi khi tài khoản nhận tiền có biến động (auth đã được
   * SepayWebhookGuard kiểm tra bằng khóa API). Mọi nhánh nghiệp vụ đều trả
   * bình thường (controller luôn phản hồi HTTP 200 {"success": true}); chỉ lỗi hạ tầng
   * (DB, hết kho …) mới ném — transaction rollback, phiên vẫn PENDING và SePay sẽ retry.
   */
  async handleWebhook(payload: SePayWebhookPayload): Promise<void> {
    // Chỉ quan tâm tiền VÀO tài khoản.
    if (payload.transferType !== 'in') return;

    const paymentCode = this.extractPaymentCode(payload);
    if (!paymentCode) return; // chuyển khoản lạ, không thuộc đơn nào

    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode },
    });
    if (!payment || payment.status !== 'PENDING') return; // không có hoặc đã xử lý (webhook trùng)

    const expired = !!payment.expiresAt && payment.expiresAt.getTime() < Date.now();
    const underpaid =
      typeof payload.transferAmount === 'number' && payload.transferAmount < payment.amount;
    if (expired || underpaid) {
      await this.settle(payment, expired ? 'EXPIRED' : 'FAILED', {
        sepayTransactionId: payload.id ?? null,
        reason: expired
          ? 'Hết thời hạn thanh toán 2 phút'
          : 'Số tiền chuyển khoản nhỏ hơn số tiền cần thanh toán',
      });
      return;
    }

    // Đọc đơn TRƯỚC transaction để transaction (giữ khóa dòng payment) ngắn nhất có thể.
    const order = await this.ordersService.findOne(payment.orderId);
    if (order.status === OrderStatus.PAID) {
      // Đơn đã được trả bằng luồng khác (momo/card) — không hoàn tất lại.
      await this.settle(payment, 'FAILED', { reason: 'Đơn hàng đã được thanh toán' });
      return;
    }

    // Claim + trừ kho + đổi trạng thái đơn trong một transaction: thiếu nguyên
    // liệu/ly (hoặc đơn vừa được trả ở nơi khác) thì rollback cả claim.
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
      if (claim.count === 0) return; // đã có webhook khác xử lý

      await this.deductInventory(tx, order);
      await this.ordersService.updateStatus(order.id, OrderStatus.PAID, tx);
      await this.awardLoyaltyPoints(tx, order.userId, order.id, order.total);
    });
  }

  /** Chốt một phiên PENDING thành EXPIRED/FAILED, giữ nguyên các trường của result cũ. */
  private settle(
    payment: { id: number; result: unknown },
    status: 'EXPIRED' | 'FAILED',
    extra: Record<string, string | number | null> = {},
  ) {
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status, result: { ...asRecord(payment.result), status, ...extra } },
    });
  }

  /** Khớp mã thanh toán từ trường `code` hoặc nội dung chuyển khoản. */
  private extractPaymentCode(payload: SePayWebhookPayload): string | null {
    const raw = `${payload.code ?? ''} ${payload.content ?? ''}`.toUpperCase();
    const match = raw.match(/PL[0-9A-F]{10}/);
    return match ? match[0] : null;
  }

  /**
   * Chỉ dành cho demo local: giả lập một giao dịch chuyển khoản thành công
   * cho phiên PENDING mới nhất của đơn (SePay không gọi được localhost).
   * Đi trọn vẹn qua handleWebhook nên hết hạn/thiếu tiền vẫn bị chặn như thật.
   */
  async simulateSePayPayment(
    orderId: string | number,
    user?: AuthUser,
  ): Promise<{ success: true }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Chức năng mô phỏng chỉ dùng cho môi trường demo local.',
      );
    }

    const order = await this.ordersService.findOne(orderId, user);
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: order.id, method: 'sepay', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment || !payment.paymentCode) {
      throw new BadRequestException(
        'Đơn hàng không có phiên thanh toán SePay nào đang chờ.',
      );
    }

    await this.handleWebhook({
      id: Date.now(),
      code: payment.paymentCode,
      transferType: 'in',
      transferAmount: payment.amount,
      referenceCode: `SIM-${Date.now()}`,
    });
    return { success: true };
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
      await this.settle(payment, 'EXPIRED');
      payment.status = 'EXPIRED';
    }

    return this.toPaymentRecord(payment);
  }

  private toPaymentRecord(payment: {
    id: number;
    orderId: number;
    method: string;
    amount: number;
    status: string;
    result: unknown;
    idempotencyKey: string | null;
    createdAt: Date;
    expiresAt?: Date | null;
    paymentCode?: string | null;
  }): PaymentRecord {
    const result = (payment.result ?? {}) as {
      transactionId?: string;
      qrUrl?: string;
    };
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method as PaymentRecord['method'],
      amount: payment.amount,
      status: payment.status as PaymentStatus,
      transactionId: result.transactionId ?? `TXN-${payment.id}`,
      idempotencyKey: payment.idempotencyKey ?? undefined,
      createdAt: payment.createdAt.toISOString(),
      expiresAt: payment.expiresAt?.toISOString() ?? undefined,
      paymentCode: payment.paymentCode ?? undefined,
      qrUrl: typeof result.qrUrl === 'string' ? result.qrUrl : undefined,
    };
  }
}
