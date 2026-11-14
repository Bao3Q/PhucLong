export interface ProductOption {
  id: number;
  name: string;
  price: number;
}

export interface Product {
  id: number;
  name: string;
  category?: string;
  basePrice: number;
  description: string;
  image: string;
  tag?: string | null;
  toppings: ProductOption[];
}

export interface CartItem {
  product: Product;
  size: 'S' | 'M' | 'L';
  toppings: ProductOption[];
  note: string;
  quantity: number;
  totalPrice: number;
}
