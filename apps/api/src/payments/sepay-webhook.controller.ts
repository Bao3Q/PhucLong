import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SepayService } from './sepay.service';
import { SepayWebhookGuard } from './sepay-webhook.guard';


/**
 * Webhook nằm ngoài PaymentsController (nơi mọi route đều cần JWT người dùng):
 * nó xác thực bằng khóa API riêng của SePay chứ không phải JWT.
 */
@Controller('payments/sepay')
export class SepayWebhookController {
  constructor(private readonly sepayService: SepayService) {}

  // SePay cần HTTP 200 với body {"success": true} để coi là gửi thành công; sai khóa
  // API → 401, không khớp đơn/số tiền/hết hạn → 4xx (SePay hiện lỗi và retry).
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(SepayWebhookGuard)
  async handleWebhook(@Body() payload: unknown) {
    await this.sepayService.handleWebhook(payload);
    return { success: true };
  }
}
