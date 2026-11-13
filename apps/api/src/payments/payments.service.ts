import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
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

    await this.ordersService.updateStatus(order.id, 'PAID');

    const payment = await this.prisma.payment.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        method: method || 'card',
        success: true,
        idempotencyKey,
        requestFingerprint: `${order.id}:${method || 'card'}`,
        result: { transactionId, status: 'SUCCEEDED' },
        amount: order.totalAmount,
      },
    });

    return this.toPaymentRecord(payment);
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
