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
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { AuthUser } from '../common/auth/auth-user.interface';

// Webhook SePay đã tách sang sepay-webhook.controller.ts: nó xác thực bằng
// khóa API (SepayWebhookGuard) chứ không phải JWT như các route bên dưới.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Luồng momo/card (hoàn tất ngay) — cần đăng nhập và chỉ chủ đơn (hoặc ADMIN)
  // được thanh toán: không còn ai đánh dấu đơn của người khác PAID được.
  @Post()
  @UseGuards(JwtAuthGuard)
  async pay(
    @Req() request: Request & { user: AuthUser },
    @Body('orderId') orderId: string,
    @Body('method') method: 'momo' | 'card',
    @Headers('idempotency-key') headerKey?: string,
    @Body('idempotencyKey') bodyKey?: string,
  ) {
    const key = headerKey || bodyKey;
    return this.paymentsService.processPayment(orderId, method, key, request.user);
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

  // Mô phỏng chuyển khoản — chỉ cho demo local (SePay không gọi được localhost),
  // backend tự chặn khi NODE_ENV=production.
  @Post('sepay/simulate')
  @UseGuards(JwtAuthGuard)
  simulateSePay(
    @Req() request: Request & { user: AuthUser },
    @Body('orderId') orderId: string,
  ) {
    return this.paymentsService.simulateSePayPayment(orderId, request.user);
  }

  // Điểm thưởng tích lũy của user đang đăng nhập — khai báo trước @Get(':orderId')
  // để không bị nuốt vào route param.
  @Get('loyalty')
  @UseGuards(JwtAuthGuard)
  async getLoyaltyPoints(@Req() request: Request & { user: AuthUser }) {
    return this.paymentsService.getLoyaltyPoints(request.user);
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
