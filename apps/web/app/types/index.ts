export interface ProductOption {
  id: number;
  name: string;
  price: number;
}

export interface Product {
  /** id dạng string để khớp với Product.id trong PostgreSQL. */
  id: string;
  name: string;
  category?: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
  stock?: number;
  toppings: ProductOption[];
  sizes?: ProductOption[];
}

export interface CartItem {
  product: Product;
  size: 'S' | 'M' | 'L';
  toppings: ProductOption[];
  note: string;
  quantity: number;
  totalPrice: number;
}

/** POST /orders — client chỉ gửi danh sách món, giá do server tự tính. */
export interface CreateOrderItemPayload {
  productId: string;
  size: 'S' | 'M' | 'L';
  toppings: string[];
  qty: number;
  note?: string;
}
