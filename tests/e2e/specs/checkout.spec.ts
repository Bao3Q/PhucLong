import { expect, test } from '@playwright/test';

/**
 * E2E-T01 (Task 5.2): luồng chính từ menu đến xác nhận đơn, đúng như người dùng thao tác.
 * Thanh toán bằng thẻ (mô phỏng, hoàn tất ngay) để không phụ thuộc SePay thật.
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const PASSWORD = 'Password123!';

test('E2E-T01 menu → giỏ hàng → đăng nhập → thanh toán thẻ → xác nhận đơn', async ({ page, request }) => {
  // Tài khoản mới cho mỗi lần chạy (tạo qua API cho nhanh)
  const email = `e2e.${Date.now()}@e2e.phuclong.vn`;
  const register = await request.post(`${API_URL}/auth/register`, { data: { email, password: PASSWORD } });
  expect(register.status()).toBe(201);

  // 1. Menu tải dữ liệu từ API
  await page.goto('/');
  const product = page.getByRole('heading', { name: 'Cappuccino Espresso' });
  await expect(product).toBeVisible();

  // 2. Mở chi tiết món, thêm vào giỏ
  await product.click();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  const cartLink = page.getByRole('link', { name: /^Giỏ hàng, 1 món/ });
  await expect(cartLink).toBeVisible();

  // 3. Sang trang thanh toán, chọn thẻ; chưa đăng nhập → bị chuyển tới /login
  await cartLink.click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole('radio', { name: 'Thẻ ngân hàng' }).check();
  await page.getByRole('button', { name: /Xác nhận trả/ }).click();
  await expect(page).toHaveURL(/\/login\?next=/);

  // 4. Đăng nhập → quay lại /checkout, giỏ hàng vẫn còn
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole('link', { name: /^Giỏ hàng, 1 món/ })).toBeVisible();

  // 5. Thanh toán thẻ → trang đặt hàng thành công
  await page.getByRole('radio', { name: 'Thẻ ngân hàng' }).check();
  await page.getByRole('button', { name: /Xác nhận trả/ }).click();
  await expect(page).toHaveURL(/\/order-success\?orderId=\d+/);
  await expect(page.getByRole('heading', { name: 'Đặt Hàng Thành Công!' })).toBeVisible();

  // 6. Màn hình xác nhận đơn (Task 9) hiện trạng thái Đã thanh toán
  await page.getByRole('button', { name: /Xem chi tiết đơn/ }).click();
  await expect(page).toHaveURL(/\/orders\/\d+/);
  await expect(page.getByText('Đã thanh toán').first()).toBeVisible();

  // 7. Lịch sử đơn có đơn vừa đặt
  await page.goto('/orders');
  await expect(page.getByText('Đã thanh toán').first()).toBeVisible();
});
