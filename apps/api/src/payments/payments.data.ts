export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';

/** Phiên thanh toán SePay trả về cho frontend (QR chuyển khoản). */
export interface SePaySession {
  orderId: number;
  paymentCode: string;
  qrUrl: string;
  amount: number;
  expiresAt: string;
}

/** Payload JSON SePay POST lên webhook khi có giao dịch vào tài khoản. */
export interface SePayWebhookPayload {
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content?: string;
  transferType?: string;
  description?: string;
  transferAmount?: number;
  accumulated?: number;
  referenceCode?: string;
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
  /** Hạn chót của phiên SePay — frontend dùng để đếm ngược. */
  expiresAt?: string;
  paymentCode?: string;
}
