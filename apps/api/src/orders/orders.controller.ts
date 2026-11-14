import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
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
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(request.user, dto);
  }

  // Lịch sử đơn của chính mình — phải khai báo trước @Get(':id') để không bị nuốt route
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@Req() request: Request & { user: AuthUser }) {
    return this.ordersService.findMyOrders(request.user.id);
  }

  // Xem chi tiết đơn cần đăng nhập; chỉ chủ đơn hoặc ADMIN được xem (người khác → 403)
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(
    @Req() request: Request & { user: AuthUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.findOne(id, request.user);
  }

  // Chuyển trạng thái đơn (chủ đơn hoặc ADMIN); sai bước chuyển → 400
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Req() request: Request & { user: AuthUser },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(
      request.user,
      id,
      dto.status,
    );
  }
}
