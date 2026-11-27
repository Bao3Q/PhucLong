import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { PromotionsService } from './promotions.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
  ) {}

  // Khách hàng kiểm tra voucher
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(
      dto.code,
      dto.subtotal,
    );
  }

  // Khách hàng xem voucher
  @Get('available')
  async listAvailable() {
    return this.promotionsService.listAvailable();
  }

  // Admin xem tất cả voucher
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listForAdmin() {
    return this.promotionsService.listForAdmin();
  }

  // Admin tạo voucher
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.createPromotion(dto);
  }

  // Admin sửa voucher
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.updatePromotion(id, dto);
  }
}