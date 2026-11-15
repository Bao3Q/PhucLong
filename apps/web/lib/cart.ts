'use client';

/**
 * Giỏ hàng dùng chung toàn app: Zustand vanilla store được truyền qua Context
 * (CartProvider mounted trong app/layout.tsx), đồng bộ localStorage key
 * 'phuclong_cart' — cùng key với giỏ cũ để không mất dữ liệu người dùng.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { CreateOrderItem, Product, ProductOption } from './api';

export interface CartItem {
  /** Id gộp biến thể: `${productId}-${size}-${toppings}` — để gộp món trùng. */
  id: string;
  product: Product;
  size: 'S' | 'M' | 'L';
  toppings: ProductOption[];
  note: string;
  quantity: number;
  /** Đơn giá × số lượng — chỉ để HIỂN THỊ, server tự tính tiền khi tạo đơn. */
  totalPrice: number;
}

const cartStorageKey = 'phuclong_cart';

/** Sinh id gộp biến thể (món cùng sản phẩm + size + topping = 1 dòng). */
export function cartItemId(
  productId: string,
  size: 'S' | 'M' | 'L',
  toppings: ProductOption[],
): string {
  const toppingKey = toppings
    .map((t) => t.name)
    .sort()
    .join('|');
  return `${productId}-${size}-${toppingKey || 'no-toppings'}`;
}

type CartState = {
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
};

/** Zustand owns the state; Context chỉ truyền store instance scoped theo layout. */
const createCartStore = () =>
  createStore<CartState>()((set) => ({
    cart: [],
    setCart: (next) =>
      set((state) => ({
        cart: typeof next === 'function' ? next(state.cart) : next,
      })),
  }));

const CartContext = createContext<ReturnType<typeof createCartStore> | undefined>(
  undefined,
);

/** Validate 1 dòng giỏ từ localStorage (giỏ hỏng/giỏ cũ lạ → loại bỏ toàn bộ). */
const isCartItem = (value: unknown): value is CartItem => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const product = item.product as Record<string, unknown> | undefined;
  return (
    (item.id === undefined || typeof item.id === 'string') &&
    typeof product === 'object' &&
    product !== null &&
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    typeof product.basePrice === 'number' &&
    (item.size === 'S' || item.size === 'M' || item.size === 'L') &&
    Array.isArray(item.toppings) &&
    item.toppings.every(
      (topping) =>
        typeof topping === 'object' &&
        topping !== null &&
        typeof (topping as ProductOption).name === 'string',
    ) &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.totalPrice === 'number'
  );
};

export function CartProvider({ children }: { children: ReactNode }) {
  // Giỏ rỗng ở server và lần render đầu giúp Next.js hydrate nhất quán.
  const [store] = useState(createCartStore);

  useEffect(() => {
    let restored: CartItem[] = [];
    try {
      const saved = window.localStorage.getItem(cartStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(isCartItem)) {
          // Giỏ cũ (trước khi có id composite) → tự sinh id để tiếp tục gộp được.
          restored = parsed.map((item) => ({
            ...item,
            id: item.id ?? cartItemId(item.product.id, item.size, item.toppings),
          }));
        }
      }
    } catch (error) {
      console.error('Không thể tải giỏ hàng đã lưu:', error);
    }
    store.getState().setCart(restored);
    // Subscribe SAU khi restore để lần setCart([]) đầu không xóa nhầm dữ liệu đã lưu.
    return store.subscribe(({ cart }) => {
      try {
        window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      } catch (error) {
        console.error('Không thể lưu giỏ hàng:', error);
      }
    });
  }, [store]);

  return createElement(CartContext.Provider, { value: store }, children);
}

/** Đọc Zustand state và re-render khi giỏ thay đổi. */
export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được sử dụng bên trong CartProvider');
  }
  return useStore(context);
}

export const cartCount = (cart: CartItem[]) =>
  cart.reduce((count, item) => count + item.quantity, 0);

export const cartTotal = (cart: CartItem[]) =>
  cart.reduce((sum, item) => sum + item.totalPrice, 0);

/** Giỏ → danh sách dòng gửi lên POST /orders (không gửi giá — server tự tính). */
export const toOrderItems = (cart: CartItem[]): CreateOrderItem[] =>
  cart.map((item) => ({
    productId: item.product.id,
    size: item.size,
    toppings: item.toppings.map((topping) => topping.name),
    qty: item.quantity,
    note: item.note || undefined,
  }));

/** Thêm 1 món vào giỏ có gộp theo id composite (trả giỏ mới, bất biến). */
export function addToCart(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.find((entry) => entry.id === item.id);
  if (existing) {
    return cart.map((entry) =>
      entry.id === item.id
        ? {
            ...entry,
            quantity: entry.quantity + item.quantity,
            totalPrice: entry.totalPrice + item.totalPrice,
          }
        : entry,
    );
  }
  return [...cart, item];
}
