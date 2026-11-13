import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { OrderItem } from './orders.data';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { AuthUser } from '../common/auth/auth-user.interface';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Cần đăng nhập mới được đặt đơn (không có JWT hợp lệ → 401)
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() request: Request & { user: AuthUser },
    @Body('items') items: OrderItem[],
  ) {
    return this.ordersService.createOrder(request.user, items || []);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
