export interface PaymentRecord {
  id: number;
  orderId: number;
  method: 'momo' | 'card';
  amount: number;
  status: 'SUCCEEDED' | 'FAILED';
  transactionId: string;
  idempotencyKey?: string;
  createdAt: string;
}
