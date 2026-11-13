import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderItem } from './orders.data';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(@Body('items') items: OrderItem[]) {
    return this.ordersService.createOrder(items || []);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
