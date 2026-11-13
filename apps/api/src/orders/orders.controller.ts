import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderItem } from './orders.data';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Cần đăng nhập mới được đặt đơn (không có JWT hợp lệ → 401)
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body('items') items: OrderItem[]) {
    return this.ordersService.createOrder(items || []);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
