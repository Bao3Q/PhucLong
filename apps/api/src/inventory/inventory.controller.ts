import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  // Xem tồn kho nguyên liệu + ly (dùng để demo/verify việc trừ kho)
  @Get()
  async findAll() {
    const [ingredients, cups] = await Promise.all([
      this.prisma.ingredient.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.cup.findMany({ orderBy: { size: 'asc' } }),
    ]);
    return { ingredients, cups };
  }
}
