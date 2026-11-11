export interface Product {
  id: number;
  name: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
}

export interface CartItem {
  product: Product;
  size: 'S' | 'M' | 'L';
  hasTranChau: boolean;
  hasKem: boolean;
  note: string;
  quantity: number;
  totalPrice: number;
}