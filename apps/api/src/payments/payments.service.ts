import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import {
  PaymentRecord,
  PAYMENTS_DB,
  IDEMPOTENCY_STORE,
} from './payments.data';

@Injectable()
export class PaymentsService {
  constructor(private readonly ordersService: OrdersService) { }

  async processPayment(
    orderId: string,
    method: 'momo' | 'card',
    idempotencyKey?: string,
  ): Promise<PaymentRecord> {

    if (idempotencyKey && IDEMPOTENCY_STORE.has(idempotencyKey)) {
      return IDEMPOTENCY_STORE.get(idempotencyKey)!;
    }


    const order = await this.ordersService.findOne(orderId);

    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán trước đó.');
    }


    const transactionId = `TXN-${(method || 'CARD').toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const paymentRecord: PaymentRecord = {
      id: `PAY-${Date.now().toString().slice(-6)}`,
      orderId: order.id,
      method: method || 'card',
      amount: order.totalAmount,
      status: 'SUCCEEDED',
      transactionId,
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };


    await this.ordersService.updateStatus(order.id, 'PAID');


    PAYMENTS_DB.push(paymentRecord);
    if (idempotencyKey) {
      IDEMPOTENCY_STORE.set(idempotencyKey, paymentRecord);
    }

    return paymentRecord;
  }

  async getByOrderId(orderId: string): Promise<PaymentRecord | undefined> {
    return PAYMENTS_DB.find((p) => p.orderId === orderId);
  }
}
