import { IsEnum } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';

/** PATCH /orders/:id/status — trạng thái mới của đơn. */
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
