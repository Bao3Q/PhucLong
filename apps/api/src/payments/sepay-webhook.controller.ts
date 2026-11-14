import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SepayWebhookGuard } from './sepay-webhook.guard';
import type { SePayWebhookPayload } from './payments.data';

/**
 * Webhook nằm ngoài PaymentsController (nơi mọi route đều cần JWT người dùng):
 * nó xác thực bằng khóa API riêng của SePay chứ không phải JWT.
 */
@Controller('payments/sepay')
export class SepayWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // SePay gọi khi tài khoản nhận tiền có giao dịch. Phải trả HTTP 200 với
  // body đúng {"success": true}; sai khóa API trả 401 để SePay tự retry.
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(SepayWebhookGuard)
  async handleWebhook(@Body() payload: SePayWebhookPayload) {
    await this.paymentsService.handleWebhook(payload);
    return { success: true };
  }
}
