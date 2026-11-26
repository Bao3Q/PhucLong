import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AuthNav from '@/components/AuthNav';
import { setToken } from '@/lib/auth';
import { CartProvider, useCart } from '@/lib/cart';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function CartCount() {
  const { cart } = useCart();
  return <span>{cart.length} món</span>;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

it('xóa giỏ hiện tại và giỏ đã lưu khi bấm Đăng xuất', () => {
  setToken('test-token');
  const item = {
    id: '1-S-no-toppings',
    product: { id: '1', name: 'Trà', basePrice: 45000 },
    size: 'S',
    toppings: [],
    note: '',
    quantity: 1,
    totalPrice: 45000,
  };
  window.localStorage.setItem('phuclong_cart', JSON.stringify([item]));
  const { unmount } = render(<CartProvider><AuthNav /><CartCount /></CartProvider>);
  expect(screen.getByText('1 món')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

  expect(screen.getByText('0 món')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
  unmount();
  render(<CartProvider><CartCount /></CartProvider>);
  expect(screen.getByText('0 món')).toBeTruthy();
});

