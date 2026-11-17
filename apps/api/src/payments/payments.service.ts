import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoyaltyTransactionType, Prisma, ProductSize } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRecord, PaymentStatus } from './payments.data';

/** Cứ mỗi 10.000đ được thanh toán thành công thì tặng 1 điểm loyalty. */
const LOYALTY_EARN_UNIT = 10_000;

/** Nhận diện lỗi unique constraint của Prisma (trùng khóa idempotency). */
export function isUniqueViolation(error: unknown): boolean {
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
        await this.fulfillOrder(tx, order);

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
   * Hoàn tất một đơn đã nhận tiền, dùng chung cho mọi cách thanh toán: trừ kho →
   * đơn PAID → cộng điểm loyalty. Chạy trong transaction của người gọi, nên lỗi ở
   * bất kỳ bước nào (hết ly/nguyên liệu, đơn đổi trạng thái …) rollback toàn bộ.
   */
  async fulfillOrder(
    tx: Prisma.TransactionClient,
    order: Order,
  ): Promise<{ earnedPoints: number; totalPoints: number }> {
    await this.deductInventory(tx, order);
    await this.ordersService.updateStatus(order.id, OrderStatus.PAID, tx);
    return this.awardLoyaltyPoints(tx, order.userId, order.id, order.total);
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
  ): Promise<{ earnedPoints: number; totalPoints: number }> {
    const points = Math.floor(total / LOYALTY_EARN_UNIT);
    if (points <= 0) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { loyaltyPoints: true },
      });
      return { earnedPoints: 0, totalPoints: user?.loyaltyPoints ?? 0 };
    }

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
    return { earnedPoints: points, totalPoints: loyaltyPoints };
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

  private toPaymentRecord(payment: {
    id: number;
    orderId: number;
    method: string;
    amount: number;
    status: string;
    result: unknown;
    idempotencyKey: string | null;
    createdAt: Date;
  }): PaymentRecord {
    const result = (payment.result ?? {}) as { transactionId?: string };
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method as PaymentRecord['method'],
      amount: payment.amount,
      status: payment.status as PaymentStatus,
      transactionId: result.transactionId ?? `TXN-${payment.id}`,
      idempotencyKey: payment.idempotencyKey ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
