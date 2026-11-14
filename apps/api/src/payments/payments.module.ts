import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { SepayWebhookController } from './sepay-webhook.controller';
import { SepayWebhookGuard } from './sepay-webhook.guard';
import { PaymentsService } from './payments.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, SepayWebhookController],
  providers: [PaymentsService, SepayWebhookGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
