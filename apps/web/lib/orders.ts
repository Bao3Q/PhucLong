/**
 * UI helpers cho trang đơn hàng (task9). Phần gọi API đã dời về lib/api.ts —
 * file này re-export để các trang cũ không phải đổi import.
 */
import type { OrderStatus } from './api';

export {
  fetchMyOrders,
  fetchOrder,
  type ApiResult,
  type ApiErrorKind as ErrorKind,
  type Order,
  type OrderItem,
  type OrderStatus,
} from './api';

/** Nhãn tiếng Việt + màu cho từng trạng thái đơn. */
export const STATUS_INFO: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Chờ thanh toán', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  PAID: { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PAYMENT_FAILED: { label: 'Thanh toán thất bại', className: 'bg-red-50 text-red-700 border-red-200' },
  PREPARING: { label: 'Đang pha chế', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  READY: { label: 'Sẵn sàng – mời nhận', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  COMPLETED: { label: 'Hoàn tất', className: 'bg-stone-100 text-stone-700 border-stone-200' },
  CANCELLED: { label: 'Đã huỷ', className: 'bg-stone-100 text-stone-500 border-stone-200' },
};

export function statusInfo(status: string) {
  return (
    STATUS_INFO[status as OrderStatus] ?? {
      label: status,
      className: 'bg-stone-100 text-stone-700 border-stone-200',
    }
  );
}

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
