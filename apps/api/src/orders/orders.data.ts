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
  id: number;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status:
    | 'PENDING_PAYMENT'
    | 'PAID'
    | 'PAYMENT_FAILED'
    | 'PREPARING'
    | 'READY'
    | 'COMPLETED'
    | 'CANCELLED';
  createdAt: string;
}
