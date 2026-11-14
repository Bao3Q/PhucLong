import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import type { SePayWebhookPayload } from './payments.data';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { AuthUser } from '../common/auth/auth-user.interface';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Giữ luồng momo/card (hoàn tất ngay) cho so sánh/demo nội bộ.
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

  // Tạo phiên thanh toán SePay (QR chuyển khoản) — cần đăng nhập, chỉ chủ đơn.
  @Post('sepay')
  @UseGuards(JwtAuthGuard)
  createSePay(
    @Req() request: Request & { user: AuthUser },
    @Body('orderId') orderId: string,
  ) {
    return this.paymentsService.createSePayPayment(orderId, request.user);
  }

  // SePay gọi khi tài khoản nhận tiền có giao dịch. Phải trả HTTP 200 với
  // body đúng {"success": true}; sai khóa API trả 401 để SePay tự retry.
  @Post('sepay/webhook')
  async sePayWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: SePayWebhookPayload,
  ) {
    await this.paymentsService.handleWebhook(authorization, payload);
    return { success: true };
  }

  // Tra trạng thái thanh toán — frontend poll mỗi vài giây trong phiên SePay.
  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async getByOrder(
    @Req() request: Request & { user: AuthUser },
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.getByOrderId(orderId, request.user);
  }
}
