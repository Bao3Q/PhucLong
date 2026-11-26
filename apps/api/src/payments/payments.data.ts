export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';

/** Phiên thanh toán SePay (QR chuyển khoản) trả về cho frontend. */
export interface SePayCheckout {
  orderId: number;
  amount: number;
  /** Nội dung chuyển khoản bắt buộc — webhook dựa vào đây để khớp đơn. */
  transferDescription: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  status: 'PENDING' | 'EXPIRED';
  /** Hạn chót của mã QR (ISO 8601) — frontend dùng để đếm ngược. */
  expiresAt: string;
}

export interface PaymentRecord {
  id: number;
  orderId: number;
  method: 'momo' | 'card' | 'sepay';
  amount: number;
  status: PaymentStatus;
  transactionId: string;
  idempotencyKey?: string;
  createdAt: string;
}
