import { Body, Controller, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  // Kiểm tra voucher cho đơn chưa tạo (preview giảm giá trước khi xác nhận).
  // Không tiêu lượt dùng — lượt chỉ bị trừ khi đơn thực sự được tạo.
  @Post('validate')
  async validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(dto.code, dto.subtotal);
  }
}
