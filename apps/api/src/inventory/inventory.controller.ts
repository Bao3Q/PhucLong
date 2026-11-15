import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  // Xem tồn kho nguyên liệu + ly (dùng để demo/verify việc trừ kho)
  // Chỉ ADMIN được xem (không có JWT → 401, CUSTOMER → 403)
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    const [ingredients, cups] = await Promise.all([
      this.prisma.ingredient.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.cup.findMany({ orderBy: { size: 'asc' } }),
    ]);
    return { ingredients, cups };
  }
}
