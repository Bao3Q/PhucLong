/**
 * API client trung tâm của web Phúc Long — mọi lời gọi backend đi qua đây.
 * - Mặc định gọi same-origin `/api/*` (Next.js rewrite proxy sang backend,
 *   xem next.config.ts) nên không cần CORS; đặt NEXT_PUBLIC_API_URL để gọi thẳng.
 * - Kết quả trả về dạng ApiResult<T> (union { ok } | { ok: false, kind, message })
 *   — không throw, trang chỉ switch theo kind để chọn UI.
 * - 401 trên route cần đăng nhập tự clearToken để header/nav cập nhật ngay.
 */
import { clearToken, getToken } from './auth';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
export const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/+$/, '') : undefined;

// ==================== Types (khớp DTO phía backend) ====================

export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductOption {
  id: number;
  name: string;
  price: number;
}

/** Khớp Product trả về từ ProductsService.toApiProduct. */
export interface Product {
  id: string;
  name: string;
  category?: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
  stock?: number;
  sizes?: ProductOption[];
  toppings?: ProductOption[];
}

/** Khớp OrderItem của OrderResponseDto. */
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
  voucherDiscountAmount?: number;
  loyaltyDiscountAmount?: number;
  loyaltyPointsRedeemed?: number;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/** Dòng món gửi lên POST /orders — client KHÔNG gửi giá, server tự tính. */
export interface CreateOrderItem {
  productId: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  qty: number;
  note?: string;
}

/** Khớp SePayCheckout trả về từ POST /payments/sepay/checkout. */
export interface SePayCheckout {
  orderId: number;
  amount: number;
  /** Nội dung chuyển khoản bắt buộc (PHUCLONG-<mã đơn>) — webhook khớp đơn theo đây. */
  transferDescription: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  status: 'PENDING' | 'EXPIRED';
  /** Hạn chót của mã QR (ISO 8601) — dùng để đếm ngược. */
  expiresAt: string;
}

/** Khớp PaymentRecord trả về từ POST /payments (momo/card). */
export interface PaymentRecord {
  id: number;
  orderId: number;
  method: 'momo' | 'card' | 'sepay';
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
  transactionId: string;
  idempotencyKey?: string;
  createdAt: string;
}

export interface LoyaltyPoints {
  userId: string;
  loyaltyPoints: number;
}

export interface LoyaltyTransaction {
  id: number;
  orderId: number | null;
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';
  points: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

/** Kết quả POST /promotions/validate — xem trước giảm giá. */
export interface VoucherValidation {
  code: string;
  discountAmount: number;
  total: number;
}

export interface AvailableVoucher {
  code: string;
  name: string;
}

// ==================== ApiResult + request ====================

export type ApiErrorKind =
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'bad-request'
  | 'conflict'
  | 'network'
  | 'server';

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: ApiErrorKind; message: string };

/** Đọc message từ body lỗi của NestJS (message có thể là string hoặc string[]). */
async function readMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    return undefined;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { auth = true, ...rest } = init;

  const headers = new Headers(rest.headers);
  headers.set('Accept', 'application/json');
  if (auth) {
    const token = getToken();
    if (!token) {
      return { ok: false, kind: 'unauthenticated', message: 'Bạn chưa đăng nhập.' };
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_URL ?? '/api'}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, cache: 'no-store' });
  } catch {
    return {
      ok: false,
      kind: 'network',
      message: `Không kết nối được tới máy chủ (${API_URL ?? 'API proxy'}).`,
    };
  }

  if (res.ok) {
    return { ok: true, data: (await res.json()) as T };
  }

  const message = (await readMessage(res)) ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  if (res.status === 401) {
    if (auth) {
      // Token hết hạn/không hợp lệ → xóa để header/nav cập nhật ngay.
      clearToken();
      return {
        ok: false,
        kind: 'unauthenticated',
        message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
      };
    }
    return { ok: false, kind: 'unauthenticated', message };
  }
  if (res.status === 403) return { ok: false, kind: 'forbidden', message };
  if (res.status === 404) return { ok: false, kind: 'not-found', message };
  if (res.status === 409) return { ok: false, kind: 'conflict', message };
  if (res.status === 400) return { ok: false, kind: 'bad-request', message };
  return { ok: false, kind: 'server', message: `Máy chủ gặp lỗi (${res.status}).` };
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ==================== Endpoint wrappers ====================

/** GET /products?category=… — menu công khai. */
export function fetchProducts(category?: string): Promise<ApiResult<Product[]>> {
  const query = category && category !== 'Tất cả' ? `?category=${encodeURIComponent(category)}` : '';
  return request<Product[]>(`/products${query}`, { auth: false });
}

/** GET /products/:id — chi tiết sản phẩm (công khai). */
export function fetchProduct(id: string): Promise<ApiResult<Product>> {
  return request<Product>(`/products/${encodeURIComponent(id)}`, { auth: false });
}

export interface LoginResponse {
  accessToken: string;
  tokenType?: string;
  user?: { id: string; email: string; role: string; loyaltyPoints: number };
}

/** POST /auth/register — trùng email → kind 'conflict'. */
export function register(email: string, password: string): Promise<ApiResult<unknown>> {
  return request('/auth/register', { ...jsonBody({ email, password }), auth: false });
}

/** POST /auth/login → JWT. */
export function login(email: string, password: string): Promise<ApiResult<LoginResponse>> {
  return request<LoginResponse>('/auth/login', { ...jsonBody({ email, password }), auth: false });
}

/** GET /orders/me — lịch sử đơn của user, mới nhất trước. */
export function fetchMyOrders(): Promise<ApiResult<Order[]>> {
  return request<Order[]>('/orders/me');
}

/** GET /orders/:id — chi tiết đơn (chủ đơn hoặc ADMIN). */
export function fetchOrder(id: string | number): Promise<ApiResult<Order>> {
  return request<Order>(`/orders/${encodeURIComponent(String(id))}`);
}

/** POST /orders — tạo đơn PENDING; server tự tính giá, có thể kèm voucherCode. */
export function createOrder(
  items: CreateOrderItem[],
  voucherCode?: string,
  loyaltyPointsToRedeem = 0,
): Promise<ApiResult<Order>> {
  return request<Order>(
    '/orders',
    jsonBody({
      items,
      ...(voucherCode ? { voucherCode } : {}),
      loyaltyPointsToRedeem,
    }),
  );
}

/** PATCH /orders/:id/status — ADMIN cập nhật tiến độ; khách hủy đơn chưa trả tiền. */
export function updateOrderStatus(
  id: string | number,
  status: OrderStatus,
): Promise<ApiResult<Order>> {
  return request<Order>(`/orders/${encodeURIComponent(String(id))}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

/** POST /payments — mock momo/card (cần đăng nhập, chỉ chủ đơn). */
export function payOrder(
  orderId: number | string,
  method: 'momo' | 'card',
  idempotencyKey?: string,
): Promise<ApiResult<PaymentRecord>> {
  return request<PaymentRecord>('/payments', {
    ...jsonBody({ orderId, method }),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey ?? `payment:${orderId}:${method}`,
    },
  });
}

/**
 * POST /payments/sepay/checkout — mở hoặc lấy lại phiên QR chuyển khoản của đơn.
 * Phiên còn hạn → trả đúng phiên cũ; hết hạn → status EXPIRED, `restart` để mở phiên mới.
 */
export function createSePayCheckout(
  orderId: number,
  restart = false,
): Promise<ApiResult<SePayCheckout>> {
  return request<SePayCheckout>('/payments/sepay/checkout', jsonBody({ orderId, restart }));
}

/** POST /payments/sepay/simulate — mô phỏng chuyển khoản, chỉ cho demo local. */
export function simulateSePay(orderId: number | string): Promise<ApiResult<{ success: true }>> {
  return request<{ success: true }>('/payments/sepay/simulate', jsonBody({ orderId }));
}

/** GET /payments/loyalty — điểm thưởng của user đang đăng nhập. */
export function fetchLoyaltyPoints(): Promise<ApiResult<LoyaltyPoints>> {
  return request<LoyaltyPoints>('/payments/loyalty');
}

export function fetchAvailableVouchers(): Promise<ApiResult<AvailableVoucher[]>> {
  return request<AvailableVoucher[]>('/promotions/available', { auth: false });
}

export function fetchVoucherRedemption(): Promise<ApiResult<{ usedCodes: string[] }>> {
  return request<{ usedCodes: string[] }>('/promotions/redemption');
}

/** POST /promotions/validate — xem trước giảm giá (không tiêu lượt dùng). Cần đăng nhập. */
export function validateVoucher(
  code: string,
  subtotal: number,
): Promise<ApiResult<VoucherValidation>> {
  return request<VoucherValidation>('/promotions/validate', {
    ...jsonBody({ code, subtotal }),
  });
}
//Thêm API lấy lịch sử điểm
export function fetchLoyaltyHistory():
  Promise<ApiResult<LoyaltyTransaction[]>> {
  return request<LoyaltyTransaction[]>(
    '/payments/loyalty/history'
  );
}
