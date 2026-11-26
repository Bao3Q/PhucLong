import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { OrderStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dọn đơn bỏ quên: tồn kho bị một đơn không bao giờ thanh toán giữ mãi sẽ khiến
 * menu "hết hàng" ảo. Service tự hủy đơn PENDING / PAYMENT_FAILED (phiên SePay đã
 * hết hạn mà khách không thanh toán lại) quá hạn — trừ đơn đang có phiên QR còn
 * hiệu lực —
 * hoàn lại tồn kho (qua luồng CANCELLED chuẩn của OrdersService) và đánh dấu
 * các phiên SePay đang chờ của đơn đó thành EXPIRED.
 *
 * Chỉ hoạt động khi có database (nhánh in-memory của unit test bỏ qua).
 * Chu kỳ chạy: 60 giây; TTL cấu hình bằng ORDER_PENDING_TTL_MINUTES (mặc định 10).
 */
@Injectable()
export class OrderExpiryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  /** TTL mặc định: 10 phút — gấp 5 lần hạn chót QR SePay (2 phút). */
  private static readonly DEFAULT_TTL_MINUTES = 10;
  private static readonly INTERVAL_MS = 60_000;
  private static readonly BATCH_SIZE = 20;

  private readonly logger = new Logger(OrderExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly ordersService: OrdersService,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(
      () => void this.cancelExpiredPendingOrders(),
      OrderExpiryService.INTERVAL_MS,
    );
    // Không giữ process sống chỉ để dọn đơn.
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async cancelExpiredPendingOrders(): Promise<void> {
    if (!this.prisma) return;

    const ttlMinutes = Number(
      process.env.ORDER_PENDING_TTL_MINUTES ??
        OrderExpiryService.DEFAULT_TTL_MINUTES,
    );
    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) return;

    const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
    const staleOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
        createdAt: { lt: cutoff },
        // Đang chờ khách quét QR (phiên còn hạn) thì chưa được hủy.
        payments: { none: { status: 'PENDING', expiresAt: { gt: new Date() } } },
      },
      select: { id: true },
      take: OrderExpiryService.BATCH_SIZE,
    });

    for (const { id } of staleOrders) {
      try {
        await this.ordersService.cancelExpiredOrder(id, cutoff);
      } catch {
        this.logger.error(`Không thể tự hủy đơn #${id}; sẽ thử lại ở lần quét sau`);
      }
    }
  }
}
