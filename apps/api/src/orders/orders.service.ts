import { Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderItem, ORDERS_DB } from './orders.data';

@Injectable()
export class OrdersService {
  async createOrder(items: OrderItem[]): Promise<Order> {
    const totalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const newOrder: Order = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      items,
      totalAmount,
      status: 'PENDING_PAYMENT',
      createdAt: new Date().toISOString(),
    };

    ORDERS_DB.push(newOrder);
    return newOrder;
  }

  async findOne(id: string): Promise<Order> {
    const order = ORDERS_DB.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }
    return order;
  }

  async updateStatus(
    id: string,
    status: 'PAID' | 'PAYMENT_FAILED',
  ): Promise<Order> {
    const order = await this.findOne(id);
    order.status = status;
    return order;
  }
}
