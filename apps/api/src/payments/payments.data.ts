export interface PaymentRecord {
  id: string;
  orderId: string;
  method: 'momo' | 'card';
  amount: number;
  status: 'SUCCEEDED' | 'FAILED';
  transactionId: string;
  idempotencyKey?: string;
  createdAt: string;
}

export const PAYMENTS_DB: PaymentRecord[] = [];
export const IDEMPOTENCY_STORE = new Map<string, PaymentRecord>();
