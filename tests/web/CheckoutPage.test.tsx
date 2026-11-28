import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CheckoutPage from '@/app/checkout/page';
import { setToken } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';

vi.mock('@/components/SiteHeader', () => ({ default: () => null }));

const fetchMock = vi.fn<typeof fetch>();
let loyaltyPoints: number;

beforeEach(() => {
  loyaltyPoints = 3;
  setToken('test-token');
  localStorage.setItem('phuclong_cart', JSON.stringify([{
    id: '1-S',
    product: { id: '1', name: 'Trà', basePrice: 50000 },
    size: 'S',
    toppings: [],
    note: '',
    quantity: 1,
    totalPrice: 50000,
  }]));
  fetchMock.mockImplementation(async (url) => {
    if (String(url).endsWith('/payments/loyalty')) {
      return Response.json({ userId: '1', loyaltyPoints });
    }
    if (String(url).endsWith('/promotions/available')) {
      return Response.json([{ code: 'WELCOME10', name: 'Giảm 10% đơn đầu tiên' }]);
    }
    if (String(url).endsWith('/promotions/validate')) {
      return Response.json({ code: 'WELCOME10', discountAmount: 5000, total: 45000 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

it('chọn, áp dụng và bỏ voucher từ combobox, chỉ hiển thị các phương thức thanh toán ngân hàng', async () => {
  render(<CartProvider><CheckoutPage /></CartProvider>);

  const select = screen.getByRole('combobox', { name: 'Mã giảm giá' });
  await screen.findByRole('option', { name: /WELCOME10.*Giảm 10% đơn đầu tiên/ });
  fireEvent.change(select, { target: { value: 'WELCOME10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await screen.findByText('Giảm giá (WELCOME10)');
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/promotions/validate'), expect.objectContaining({
    body: JSON.stringify({ code: 'WELCOME10', subtotal: 50000 }),
  }));

  fireEvent.change(select, { target: { value: '' } });
  expect(screen.queryByText('Giảm giá (WELCOME10)')).toBeNull();
  expect(screen.queryByText('Ví điện tử')).toBeNull();
  expect(screen.getByText('Thẻ ngân hàng')).toBeTruthy();
  expect(screen.getByText('Chuyển khoản ngân hàng')).toBeTruthy();
});

it('báo lỗi và chặn xác nhận khi nhập quá số dư điểm, nút Tối đa dùng đúng số dư', async () => {
  render(<CartProvider><CheckoutPage /></CartProvider>);
  await screen.findByText('Số điểm hiện có: 3 điểm');
  const input = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Số điểm muốn đổi' });
  const confirm = screen.getByRole<HTMLButtonElement>('button', { name: /Xác nhận trả/ });

  fireEvent.change(input, { target: { value: '4' } });
  expect(screen.getByRole('alert').textContent).toContain('Bạn chỉ có 3 điểm thưởng');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(confirm.disabled).toBe(true);
  expect(screen.queryByText('Đổi 3 điểm')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Tối đa' }));
  expect(confirm.disabled).toBe(false);
  expect(input.value).toBe('3');
  expect(screen.getByText('Đổi 3 điểm')).toBeTruthy();
});

it('tính lại số điểm tối đa theo giá trị đơn sau khi áp voucher', async () => {
  loyaltyPoints = 20;
  render(<CartProvider><CheckoutPage /></CartProvider>);
  await screen.findByText('Số điểm hiện có: 20 điểm');
  const input = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Số điểm muốn đổi' });
  fireEvent.click(screen.getByRole('button', { name: 'Tối đa' }));
  expect(input.value).toBe('10');

  fireEvent.change(screen.getByRole('combobox', { name: 'Mã giảm giá' }), { target: { value: 'WELCOME10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
  await screen.findByText('Giảm giá (WELCOME10)');
  expect(screen.getByRole('alert').textContent).toContain('Đơn hàng này dùng tối đa 9 điểm');
  expect(screen.getByRole<HTMLButtonElement>('button', { name: /Xác nhận trả/ }).disabled).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'Tối đa' }));
  expect(input.value).toBe('9');
  expect(screen.getByText('Đổi 9 điểm')).toBeTruthy();
});
