export interface OrderItem {
  productId: number;
  productName: string;
  size: 'S' | 'M' | 'L';
  quantity: number;
  unitPrice: number;
  toppings?: string[];
  note?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';
  createdAt: string;
}

export const ORDERS_DB: Order[] = [];
