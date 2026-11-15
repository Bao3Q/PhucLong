/**
 * Types dùng chung của web — nguồn sự thật là lib/api.ts (khớp DTO backend)
 * và lib/cart.ts (giỏ hàng). File này chỉ re-export cho các trang dùng cũ.
 */
export type { Product, ProductOption, CreateOrderItem, OrderStatus } from '@/lib/api';
export type { CartItem } from '@/lib/cart';
