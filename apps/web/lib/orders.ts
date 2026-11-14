/**
 * Task 9 – gọi API xem đơn (GET /orders/me, GET /orders/:id) và các hàm hiển thị.
 * Mọi lời gọi đều gắn JWT; kết quả trả về dạng { ok: true, data } | { ok: false, kind, message }
 * để trang chọn đúng giao diện (cần đăng nhập, không tìm thấy, lỗi mạng…).
 */
import { clearToken, getToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  id: number;
  productId: string;
  productName: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  note?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Khớp OrderResponseDto ở apps/api/src/orders/dto/order-response.dto.ts. */
export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  voucherCode?: string;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export type ErrorKind =
  | 'unauthenticated' // chưa đăng nhập / token hết hạn (401)
  | 'forbidden' // đơn của người khác (403)
  | 'not-found' // không có đơn (404)
  | 'network' // không gọi được máy chủ
  | 'server'; // lỗi khác

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ErrorKind; message: string };

async function getJson<T>(path: string): Promise<ApiResult<T>> {
  const token = getToken();
  if (!token) {
    return { ok: false, kind: 'unauthenticated', message: 'Bạn cần đăng nhập để xem đơn hàng.' };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, kind: 'network', message: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' };
  }

  if (res.ok) {
    return { ok: true, data: (await res.json()) as T };
  }
  if (res.status === 401) {
    clearToken(); // token hết hạn/sai → xoá để lần sau đăng nhập lại
    return { ok: false, kind: 'unauthenticated', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
  }
  if (res.status === 403) {
    return { ok: false, kind: 'forbidden', message: 'Đơn hàng này không thuộc tài khoản của bạn.' };
  }
  if (res.status === 404) {
    return { ok: false, kind: 'not-found', message: 'Không tìm thấy đơn hàng.' };
  }
  return { ok: false, kind: 'server', message: `Máy chủ gặp lỗi (${res.status}). Vui lòng thử lại.` };
}

/** GET /orders/me – lịch sử đơn của người đang đăng nhập, mới nhất trước. */
export function fetchMyOrders(): Promise<ApiResult<Order[]>> {
  return getJson<Order[]>('/orders/me');
}

/** GET /orders/:id – chi tiết một đơn (chỉ chủ đơn hoặc ADMIN). */
export function fetchOrder(id: string | number): Promise<ApiResult<Order>> {
  return getJson<Order>(`/orders/${encodeURIComponent(String(id))}`);
}

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
  return STATUS_INFO[status as OrderStatus] ?? { label: status, className: 'bg-stone-100 text-stone-700 border-stone-200' };
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
