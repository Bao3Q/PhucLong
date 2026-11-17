import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { SepayService } from './sepay.service';
import { CreateSePayCheckoutDto } from './dto/create-sepay-checkout.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { AuthUser } from '../common/auth/auth-user.interface';

// Webhook SePay nằm ở sepay-webhook.controller.ts: nó xác thực bằng khóa API
// (SepayWebhookGuard) chứ không phải JWT như các route bên dưới.
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly sepayService: SepayService,
  ) {}

  // Luồng momo/card (hoàn tất ngay) — chỉ chủ đơn (hoặc ADMIN) được thanh toán.
  @Post()
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

  // Mở (hoặc lấy lại) phiên SePay của đơn: QR + hạn chót. Gọi lại khi phiên còn hạn
  // thì trả đúng phiên cũ; hết hạn → status EXPIRED, `restart: true` để mở phiên mới.
  @Post('sepay/checkout')
  createSePayCheckout(
    @Req() request: Request & { user: AuthUser },
    @Body() dto: CreateSePayCheckoutDto,
  ) {
    return this.sepayService.createCheckout(request.user.id, dto.orderId, dto.restart ?? false);
  }

  // Mô phỏng chuyển khoản — chỉ cho demo local (SePay không gọi được localhost),
  // backend tự chặn khi NODE_ENV=production.
  @Post('sepay/simulate')
  simulateSePay(
    @Req() request: Request & { user: AuthUser },
    @Body('orderId') orderId: number,
  ) {
    return this.sepayService.simulate(Number(orderId), request.user);
  }

  // Điểm thưởng tích lũy của user đang đăng nhập.
  @Get('loyalty')
  async getLoyaltyPoints(@Req() request: Request & { user: AuthUser }) {
    return this.paymentsService.getLoyaltyPoints(request.user);
  }
}
