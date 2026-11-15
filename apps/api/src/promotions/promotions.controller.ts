import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // Kiểm tra voucher cho đơn chưa tạo (preview giảm giá trước khi xác nhận).
  // Không tiêu lượt dùng — lượt chỉ bị trừ khi đơn thực sự được tạo.
  // Cần đăng nhập (không có JWT → 401) vì đặt đơn vốn yêu cầu JWT.
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(dto.code, dto.subtotal);
  }
}
