import { BadRequestException } from '@nestjs/common';

/**
 * Các trạng thái hợp lệ của đơn hàng (khớp enum `OrderStatus` trong schema.prisma).
 * PENDING → PAID → PREPARING → READY → COMPLETED
 * Nhánh ngoại lệ: PAYMENT_FAILED, CANCELLED.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Bảng ánh xạ các chuyển trạng thái hợp lệ. */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [], // Trạng thái kết thúc
  [OrderStatus.CANCELLED]: [], // Trạng thái kết thúc
};

/**
 * Kiểm tra và chặn chuyển trạng thái không hợp lệ.
 * Ném BadRequestException nếu chuyển đổi vi phạm sơ đồ máy trạng thái.
 */
export function assertTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): void {
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new BadRequestException(
      `Không thể chuyển trạng thái đơn hàng từ ${currentStatus} sang ${nextStatus}`,
    );
  }
}

export type ProductSize = 'S' | 'M' | 'L';

/** Dữ liệu một món hàng trong đơn. */
export interface OrderItem {
  id: number;
  orderId: number;
  productId: string;
  productName: string;
  size: ProductSize;
  toppings: string[];
  note?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Dữ liệu đơn hàng. */
export interface Order {
  id: number;
  userId: string;
  status: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  voucherCode?: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}
