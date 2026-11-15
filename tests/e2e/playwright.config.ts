import { defineConfig, devices } from '@playwright/test';

/**
 * Cần web (3000) và API (4000) đang chạy, ví dụ:
 *   docker compose up -d --build
 * hoặc như job "e2e" trong .github/workflows/ci.yml.
 *
 * E2E_BASE_URL: địa chỉ web (mặc định http://localhost:3000)
 * E2E_API_URL : địa chỉ API dùng để tạo tài khoản test (mặc định http://localhost:4000)
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
