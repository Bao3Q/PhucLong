import { describe, expect, it } from 'vitest';
import { addToCart, cartCount, cartItemId, cartTotal, toOrderItems, type CartItem } from '@/lib/cart';

// WEB-T02: logic giỏ hàng (FR-03) – gộp món trùng, tổng tiền, dữ liệu gửi POST /orders
const product = { id: '1', name: 'Cappuccino Espresso', basePrice: 45000, description: '', image: '' };
const shot = { id: 1, name: 'Shot Espresso thêm', price: 15000 };

function item(size: 'S' | 'M' | 'L', quantity: number, toppings = [] as (typeof shot)[]): CartItem {
  const unit = product.basePrice + toppings.reduce((s, t) => s + t.price, 0);
  return { id: cartItemId(product.id, size, toppings), product, size, toppings, note: '', quantity, totalPrice: unit * quantity };
}

describe('lib/cart – giỏ hàng', () => {
  it('id biến thể không phụ thuộc thứ tự topping', () => {
    const a = { id: 2, name: 'A', price: 0 };
    const b = { id: 3, name: 'B', price: 0 };
    expect(cartItemId('1', 'M', [a, b])).toBe(cartItemId('1', 'M', [b, a]));
    expect(cartItemId('1', 'M', [])).toBe('1-M-no-toppings');
  });

  it('thêm cùng món + size + topping thì cộng số lượng, khác size thì thêm dòng mới', () => {
    let cart: CartItem[] = [];
    cart = addToCart(cart, item('S', 1));
    cart = addToCart(cart, item('S', 2));
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);

    cart = addToCart(cart, item('L', 1, [shot]));
    expect(cart).toHaveLength(2);
    expect(cartCount(cart)).toBe(4);
    expect(cartTotal(cart)).toBe(45000 * 3 + (45000 + 15000));
  });

  it('addToCart không sửa mảng cũ (bất biến)', () => {
    const before = [item('S', 1)];
    const after = addToCart(before, item('S', 1));
    expect(before[0].quantity).toBe(1);
    expect(after[0].quantity).toBe(2);
  });

  it('dữ liệu gửi POST /orders không chứa giá (server tự tính)', () => {
    const [line] = toOrderItems([item('M', 2, [shot])]);
    expect(line).toEqual({ productId: '1', size: 'M', toppings: ['Shot Espresso thêm'], qty: 2, note: undefined });
    expect(line).not.toHaveProperty('totalPrice');
  });
});
