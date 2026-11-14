import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, ProductSize } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/orders.data';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRecord } from './payments.data';

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

  async getByOrderId(orderId: string | number): Promise<PaymentRecord | undefined> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: Number(orderId) },
      orderBy: { createdAt: 'desc' },
    });
    return payment ? this.toPaymentRecord(payment) : undefined;
  }

  private toPaymentRecord(payment: {
    id: number;
    orderId: number;
    method: string;
    amount: number;
    result: unknown;
    idempotencyKey: string | null;
    createdAt: Date;
  }): PaymentRecord {
    const result = payment.result as { transactionId?: string };
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method as 'momo' | 'card',
      amount: payment.amount,
      status: 'SUCCEEDED',
      transactionId: result.transactionId ?? `TXN-${payment.id}`,
      idempotencyKey: payment.idempotencyKey ?? undefined,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
