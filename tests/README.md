# Kiểm thử tích hợp và end-to-end

| Thư mục | Loại | Công cụ | Chạy |
| --- | --- | --- | --- |
| `apps/api/src/**/*.spec.ts` | Unit test API (in-memory, không cần DB) | Jest | `npm run test` |
| `tests/api` | Integration test API: HTTP thật + PostgreSQL thật (INT-T01…T07) | Jest + supertest | `npm run test:e2e:api` |
| `tests/web` | Unit/component test frontend (WEB-T01…T04) | Vitest + Testing Library | `npm run test:web` |
| `tests/e2e` | End-to-end: menu → giỏ → đăng nhập → thanh toán → xác nhận đơn (E2E-T01) | Playwright | `npm run test:e2e` |

`tests/web` và `tests/e2e` là package riêng (có `package.json` riêng), **không** thuộc npm workspaces → không làm thay đổi `package-lock.json` gốc mà Dockerfile dùng với `npm ci`.

## Integration test API

```bash
docker compose up -d postgres                      # PostgreSQL ở cổng 5433
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/phuclong_db?schema=public"
cd apps/api && npx prisma migrate deploy && cd ../..
npm run test:e2e:api
```
PowerShell: `$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/phuclong_db?schema=public"`.

Test tạo tài khoản với email ngẫu nhiên nên chạy lại nhiều lần trên cùng DB được.

## E2E

```bash
docker compose up -d --build                       # web :3000, API :4000
cd tests/e2e
npm install
npx playwright install chromium                    # lần đầu
npx playwright test
```
Biến tuỳ chọn: `E2E_BASE_URL` (mặc định `http://localhost:3000`), `E2E_API_URL` (mặc định `http://localhost:4000`).
Khi lỗi, xem báo cáo: `npx playwright show-report` (trong `tests/e2e`).
