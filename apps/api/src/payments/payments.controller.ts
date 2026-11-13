import { Controller, Post, Get, Body, Headers, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async pay(
    @Body('orderId') orderId: string,
    @Body('method') method: 'momo' | 'card',
    @Headers('idempotency-key') headerKey?: string,
    @Body('idempotencyKey') bodyKey?: string,
  ) {
    const key = headerKey || bodyKey;
    return this.paymentsService.processPayment(orderId, method, key);
  }

  @Get(':orderId')
  async getByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.getByOrderId(orderId);
  }
}
