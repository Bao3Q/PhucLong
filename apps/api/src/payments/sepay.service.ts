import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SePayCheckout } from './payments.data';
import { PaymentsService, isUniqueViolation } from './payments.service';

/** Hạn chót của một phiên SePay (giây) — đề bài yêu cầu 2 phút. */
const SEPAY_TIMEOUT_SECONDS = Number(process.env.SEPAY_TIMEOUT_SECONDS || 120);

interface SePayWebhookEvent {
  id: string;
  accountNumber: string;
  transferType: string;
  transferAmount: number;
  content: string | null;
  description: string | null;
}

interface SePayConfig {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/** Đơn còn chờ trả tiền: mới tạo, hoặc phiên trước đã hết hạn / thất bại. */
const isAwaitingPayment = (status: string) =>
  status === OrderStatus.PENDING || status === OrderStatus.PAYMENT_FAILED;

/**
 * Thanh toán chuyển khoản QR qua SePay. Mỗi đơn có đúng MỘT phiên (payment
 * `sepay-order-<id>`), nội dung chuyển khoản cố định `PHUCLONG-<id>`:
 *  - createCheckout: mở phiên / trả lại phiên đang chạy / báo hết hạn / mở lại.
 *  - handleWebhook: đối soát nghiêm ngặt, sai bất kỳ điều kiện nào → từ chối bằng
 *    4xx để SePay hiện lỗi (không âm thầm bỏ qua); chỉ khi khớp mới hoàn tất đơn.
 */
@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  async createCheckout(
    userId: string,
    orderId: number,
    restart = false,
  ): Promise<SePayCheckout> {
    const config = this.getConfig();

    // Hai request đầu tiên cho cùng đơn (vd StrictMode gọi effect hai lần) cùng
    // thấy "chưa có phiên": bên thua chạm unique → chạy lại để nhận phiên của bên thắng.
    const open = () =>
      this.prisma.$transaction((tx) => this.openSession(tx, userId, orderId, restart));
    const { payment, expired } = await open().catch((error: unknown) => {
      if (isUniqueViolation(error)) return open();
      throw error;
    });

    const transferDescription = this.transferDescription(orderId);
    const qr = new URL('https://vietqr.app/img');
    qr.searchParams.set('acc', config.accountNumber);
    qr.searchParams.set('bank', config.bankCode);
    qr.searchParams.set('amount', String(payment.amount));
    qr.searchParams.set('des', transferDescription);
    qr.searchParams.set('template', 'compact');
    qr.searchParams.set('holder', config.accountName);

    return {
      orderId,
      amount: payment.amount,
      transferDescription,
      bankCode: config.bankCode,
      accountNumber: config.accountNumber,
      accountName: config.accountName,
      qrUrl: qr.toString(),
      status: expired ? 'EXPIRED' : 'PENDING',
      expiresAt: (payment.expiresAt ?? payment.createdAt).toISOString(),
    };
  }

  /** Lõi của createCheckout, chạy trong một transaction. */
  private async openSession(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: number,
    restart: boolean,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    if (!isAwaitingPayment(order.status)) {
      throw new ConflictException('Đơn hàng không còn chờ thanh toán');
    }

    const idempotencyKey = this.intentKey(orderId);
    const existing = await tx.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing?.success) {
      throw new ConflictException('Đơn hàng đã được thanh toán');
    }
    if (existing && existing.amount !== order.total) {
      throw new ConflictException('Số tiền đơn hàng đã thay đổi; vui lòng tạo đơn mới');
    }

    const now = Date.now();
    const newExpiry = () => new Date(now + SEPAY_TIMEOUT_SECONDS * 1000);

    if (!existing) {
      const payment = await tx.payment.create({
        data: {
          userId,
          orderId,
          idempotencyKey,
          amount: order.total,
          method: 'sepay',
          success: false,
          requestFingerprint: `sepay:${orderId}:${order.total}`,
          result: this.pendingResult(orderId),
          status: 'PENDING',
          expiresAt: newExpiry(),
        },
      });
      return { payment, expired: false };
    }

    if (existing.expiresAt && existing.expiresAt.getTime() > now) {
      return { payment: existing, expired: false };
    }

    if (restart) {
      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          expiresAt: newExpiry(),
          result: this.pendingResult(orderId),
        },
      });
      return { payment, expired: false };
    }

    // Phiên đã hết hạn: đơn chuyển PAYMENT_FAILED, khách bấm "Thanh toán lại"
    // (restart) mới mở phiên mới.
    await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAYMENT_FAILED },
    });
    const payment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: 'EXPIRED',
        result: {
          success: false,
          orderId,
          status: OrderStatus.PAYMENT_FAILED,
          message: 'Phiên thanh toán SePay đã hết hạn',
          transferDescription: this.transferDescription(orderId),
        },
      },
    });
    return { payment, expired: true };
  }

  /**
   * Webhook SePay báo tiền vào. Trả bình thường khi đã ghi nhận (kể cả webhook
   * trùng); mọi trường hợp không khớp ném 4xx và để nguyên đơn.
   */
  async handleWebhook(payload: unknown): Promise<{ accepted: true; duplicate?: true }> {
    try {
      return await this.processWebhook(payload);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        this.logger.warn(`Webhook SePay bị từ chối: ${error.message}`);
      }
      throw error;
    }
  }

  private async processWebhook(
    payload: unknown,
  ): Promise<{ accepted: true; duplicate?: true }> {
    const config = this.getConfig();
    const event = this.parseWebhook(payload);
    if (event.transferType.toLowerCase() !== 'in') {
      throw new BadRequestException('SePay event không phải giao dịch tiền vào');
    }
    if (event.accountNumber !== config.accountNumber) {
      throw new BadRequestException('Giao dịch không thuộc tài khoản nhận đã cấu hình');
    }

    // Ngân hàng có thể bỏ dấu gạch nối nên `PHUCLONG-31` và `PHUCLONG31` đều khớp.
    const match = [event.content, event.description]
      .filter((value): value is string => Boolean(value))
      .map((value) => /\bPHUCLONG-?(\d+)\b/i.exec(value))
      .find((m) => m !== null);
    const orderId = match ? Number(match[1]) : NaN;
    if (!Number.isSafeInteger(orderId)) {
      throw new BadRequestException('Nội dung chuyển khoản không hợp lệ');
    }

    // Đọc đơn + phiên NGOÀI transaction để transaction (giữ khóa dòng) ngắn nhất có thể.
    const order = await this.ordersService.findOne(orderId);
    const payment = await this.prisma.payment.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: order.userId,
          idempotencyKey: this.intentKey(orderId),
        },
      },
    });
    if (!payment || payment.method !== 'sepay') {
      throw new BadRequestException('Không tìm thấy phiên thanh toán SePay cho đơn hàng');
    }
    if (event.transferAmount !== payment.amount) {
      throw new BadRequestException('Số tiền SePay không khớp với đơn hàng');
    }
    if (payment.success) {
      return this.alreadyPaid(payment.result, event.id);
    }
    if (!payment.expiresAt || payment.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Phiên thanh toán SePay đã hết hạn; vui lòng tạo lại mã QR');
    }
    if (!isAwaitingPayment(order.status)) {
      throw new ConflictException('Đơn hàng không còn ở trạng thái chờ thanh toán');
    }

    // Claim + trừ kho + đơn PAID + cộng điểm trong một transaction: thiếu nguyên
    // liệu/ly hay đơn vừa đổi trạng thái thì rollback cả claim, phiên vẫn chờ.
    return this.prisma.$transaction(async (tx) => {
      // Update có điều kiện: hai webhook trùng chạy song song thì chỉ một bên claim được.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, success: false },
        data: { success: true, status: 'PAID', paidAt: new Date() },
      });
      if (claim.count === 0) {
        const winner = await tx.payment.findUnique({ where: { id: payment.id } });
        return this.alreadyPaid(winner?.result, event.id);
      }

      const { earnedPoints, totalPoints } = await this.paymentsService.fulfillOrder(tx, order);
      const result: Prisma.InputJsonObject = {
        success: true,
        orderId,
        status: OrderStatus.PAID,
        message: 'Thanh toán SePay thành công',
        earnedLoyaltyPoints: earnedPoints,
        totalLoyaltyPoints: totalPoints,
        sepayTransactionId: event.id,
        transactionId: `TXN-SEPAY-${event.id}`,
      };
      await tx.payment.update({ where: { id: payment.id }, data: { result } });
      return { accepted: true as const };
    });
  }

  /**
   * Chỉ dành cho demo local: giả lập SePay báo "tiền đã vào" cho phiên của đơn
   * (SePay không gọi được localhost). Đi trọn vẹn qua handleWebhook nên hết hạn /
   * sai số tiền vẫn bị chặn như thật.
   */
  async simulate(orderId: number, user: AuthUser): Promise<{ success: true }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Chức năng mô phỏng chỉ dùng cho môi trường demo local.');
    }
    const config = this.getConfig();
    const order = await this.ordersService.findOne(orderId, user);
    const payment = await this.prisma.payment.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: order.userId,
          idempotencyKey: this.intentKey(order.id),
        },
      },
    });
    if (!payment) {
      throw new BadRequestException('Đơn hàng chưa có phiên thanh toán SePay.');
    }
    await this.handleWebhook({
      id: Date.now(),
      accountNumber: config.accountNumber,
      transferType: 'in',
      transferAmount: payment.amount,
      content: this.transferDescription(order.id),
    });
    return { success: true };
  }

  /** Webhook tới khi phiên đã PAID: cùng giao dịch → trùng (ổn); khác giao dịch → 409. */
  private alreadyPaid(result: unknown, transactionId: string) {
    const previous = (result ?? {}) as { sepayTransactionId?: string };
    if (previous.sepayTransactionId === transactionId) {
      return { accepted: true as const, duplicate: true as const };
    }
    throw new ConflictException('Đơn hàng đã được thanh toán bằng một giao dịch SePay khác');
  }

  private getConfig(): SePayConfig {
    const bankCode = process.env.SEPAY_BANK_CODE?.trim();
    const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER?.trim();
    const accountName = process.env.SEPAY_ACCOUNT_NAME?.trim();
    const apiKey = process.env.SEPAY_API_KEY?.trim();
    if (!bankCode || !accountNumber || !accountName || !apiKey) {
      throw new ServiceUnavailableException(
        'Thiếu cấu hình SEPAY_BANK_CODE, SEPAY_ACCOUNT_NUMBER, SEPAY_ACCOUNT_NAME hoặc SEPAY_API_KEY',
      );
    }
    return { bankCode, accountNumber, accountName };
  }

  private parseWebhook(payload: unknown): SePayWebhookEvent {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new BadRequestException('Dữ liệu webhook SePay không hợp lệ');
    }
    const value = payload as Record<string, unknown>;
    const amount = Number(value.transferAmount);
    const id = typeof value.id === 'string' ? value.id.trim() : value.id;
    const validId =
      (typeof id === 'string' && /^\d{1,30}$/.test(id)) ||
      (typeof id === 'number' && Number.isSafeInteger(id) && id > 0);
    if (
      !validId ||
      typeof value.accountNumber !== 'string' ||
      typeof value.transferType !== 'string' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new BadRequestException('Thiếu trường giao dịch bắt buộc của SePay');
    }
    return {
      id: String(id),
      accountNumber: value.accountNumber,
      transferType: value.transferType,
      transferAmount: amount,
      content: typeof value.content === 'string' ? value.content : null,
      description: typeof value.description === 'string' ? value.description : null,
    };
  }

  private pendingResult(orderId: number): Prisma.InputJsonObject {
    return {
      success: false,
      orderId,
      status: OrderStatus.PENDING,
      message: 'Đang chờ SePay xác nhận thanh toán',
      transferDescription: this.transferDescription(orderId),
    };
  }

  private intentKey(orderId: number): string {
    return `sepay-order-${orderId}`;
  }

  private transferDescription(orderId: number): string {
    return `PHUCLONG-${orderId}`;
  }
}
