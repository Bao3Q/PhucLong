# Ma trận truy vết (Traceability Matrix)

> Truy vết từ mã yêu cầu (SRS) → use-case/story → thiết kế → code/API → test. Các file test và code đều là đường dẫn thật trong repo; phần chưa hoàn thành ghi rõ `—` kèm ghi chú.

## 1. Yêu cầu chức năng (FR)

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test |
| --- | --- | --- | --- | --- |
| **FR-01** Xem menu | US-01 Xem menu danh mục · UC01 | Task2_3_Class (Product) · Task1_2_UseCase UC01 | `GET /products`, `GET /products/:id` — `apps/api/src/products/products.controller.ts`; UI menu: `apps/web/app/page.tsx` | **API-T01** `products.service.spec.ts` · **API-T06** `products.rbac.spec.ts` · **INT-T02** `tests/api/checkout.e2e-spec.ts` (`GET /products` từ PostgreSQL) · **E2E-T01** (menu tải dữ liệu) |
| **FR-02** Chi tiết món, size/topping | US-02 Chọn tùy chọn món | Task1_2_UseCase UC02 · Task2_1_Activity (nhánh chọn món) | `apps/web/components/ProductModal.tsx`; loại `ProductOption`, `CartItem` — `apps/web/app/types/index.ts` | **WEB-T02** `tests/web/cart.test.ts` (giá, gộp biến thể) · **E2E-T01** `tests/e2e/specs/checkout.spec.ts` (chọn món, thêm vào giỏ) |
| **FR-03** Quản lý giỏ hàng | US-03 Giỏ hàng & tổng tiền | Task1_2_UseCase UC03 | `apps/web/app/checkout/page.tsx`; lưu `localStorage("phuclong_cart")` — `apps/web/app/page.tsx` | **WEB-T02** `tests/web/cart.test.ts` (gộp món, tổng tiền, dữ liệu gửi POST /orders) · **E2E-T01** (giỏ giữ nguyên sau khi đăng nhập) |
| **FR-04** Đăng ký / đăng nhập JWT | US-04 Xác thực | Task2_3_Class (User) | `POST /auth/register`, `POST /auth/login` — `apps/api/src/auth/auth.controller.ts`; client: `apps/web/lib/auth.ts` | **API-T02** `auth.service.spec.ts` · **API-T05** `jwt-auth.guard.spec.ts` · **INT-T03** (409 email trùng, 401 sai mật khẩu) · **WEB-T03** `tests/web/auth.test.ts` (lưu token, chặn `?next` ra ngoài) · **E2E-T01** (đăng nhập rồi quay lại checkout) |
| **FR-05** Tạo đơn hàng | UC-01 Đặt và thanh toán (Task1_3_UseCase) | Task2_2_Sequence (tạo đơn) · Task2_1_Activity | `POST /orders` (JwtAuthGuard) — `apps/api/src/orders/orders.controller.ts`, `orders.service.ts` | **API-T03** `orders.service.spec.ts` (persist + items, từ chối giỏ rỗng) · AC-01 qua `jwt-auth.guard.spec.ts` · **INT-T04** `tests/api/checkout.e2e-spec.ts` (401 không JWT, 400 dữ liệu sai, 201 PENDING giá do server tính) |
| **FR-06** Thanh toán Ví/Thẻ mô phỏng | UC-01 (bước 6–7) | Task2_2_Sequence (alt thành công/thất bại, idempotency) · ADR-003 | `POST /payments`, `GET /payments/:orderId` — `apps/api/src/payments/payments.service.ts` | **API-T04** `payments.service.spec.ts` (idempotency, trừ kho trong transaction, hết ly/nguyên liệu, đã PAID) · **INT-T05** (thanh toán → PAID, trừ ly trong transaction) · **INT-T06** (retry cùng Idempotency-Key không trừ kho lần 2) · **E2E-T01** (thanh toán MoMo) |
| **FR-07** Xác nhận, trạng thái & lịch sử đơn | US-05 Theo dõi đơn | Task2_1_Activity (theo dõi) | `GET /orders/me`, `GET /orders/:id` (JwtAuthGuard, trả `toOrderResponse`) — `orders.controller.ts`, `orders.service.ts`; UI xác nhận: `apps/web/app/orders/[id]/page.tsx` (tự cập nhật khi PENDING), lịch sử: `apps/web/app/orders/page.tsx`, client: `apps/web/lib/orders.ts` | **API-T03** `orders.service.spec.ts` (load đơn, 403 đơn người khác, 404, lịch sử chỉ đơn của mình) · **API-T08** `orders.controller.spec.ts` (DTO không lộ `userId`, 403/404, `/orders/me`) · **INT-T07** (403 đơn người khác, `/orders/me` chỉ đơn của mình) · **WEB-T01** `tests/web/orders.test.ts` · **WEB-T04** `tests/web/StatusBadge.test.tsx` · **E2E-T01** (màn xác nhận “Đã thanh toán”, lịch sử đơn) |
| **FR-08** Khuyến mãi (Could) | US-06 Nhập mã giảm giá | Task2_3_Class (Promotion) | `POST /promotions/validate` — `apps/api/src/promotions/promotions.controller.ts`; áp mã khi `POST /orders` (`voucherCode`); UI nhập mã: `apps/web/app/checkout/page.tsx` | **API-T** `promotions.service.spec.ts` |
| **FR-09** Quản lý trạng thái đơn | US-07 Nhân viên cập nhật đơn · Task1_2_UseCase UC11, UC14 | Task2_3_Class (enum `OrderStatus`) · Task2_1_Activity (theo dõi) | `PATCH /orders/:id/status` (JwtAuthGuard; chủ đơn hoặc ADMIN) — `orders.controller.ts`; máy trạng thái `VALID_ORDER_TRANSITIONS` / `assertTransition` — `apps/api/src/orders/entities/order.entity.ts`; tự hủy đơn PENDING quá hạn — `order-expiry.service.ts` | **API-T03** `orders.service.spec.ts` (hủy đơn hoàn kho, người lạ không được đổi trạng thái) · **API-T09** `order-concurrency.spec.ts` (chặn bỏ bước, đi hết PAID → PREPARING → READY → COMPLETED, hủy đồng thời chỉ hoàn kho một lần) |

## 2. Yêu cầu phi chức năng (NFR)

| Mã yêu cầu | Thiết kế / Quyết định | Code / Cấu hình | Test / Kiểm chứng |
| --- | --- | --- | --- |
| **NFR-01** Hiệu năng (< 500ms p95) | ADR-004 (region Neon/Render) | `GET /products` trả dữ liệu nhỏ, in-memory seed | Đo thủ công; chưa có test tự động đo p95 |
| **NFR-02** Bảo mật JWT | ADR-002 · Task2_2_Sequence (kiểm tra JWT) | `apps/api/src/common/auth/jwt-auth.guard.ts`; guard trên `POST /orders`; RBAC ADMIN `POST /products` | **API-T05** `jwt-auth.guard.spec.ts` · **API-T06** `products.rbac.spec.ts` · **INT-T04/INT-T07** (401/403 qua HTTP thật) |
| **NFR-03** Mobile-first ≥ 360px, PWA | architecture.md mục 2 | Tailwind responsive — `apps/web/app/page.tsx`, `checkout/page.tsx`; PWA manifest `apps/web/app/manifest.ts`, icon `apps/web/public/icons/` | Kiểm thử thủ công responsive |
| **NFR-04** Docker + health check | ADR-002 · ADR-004 | `Dockerfile`, `docker-compose.yml` (postgres healthcheck, `migrate deploy`); `GET /health` — `apps/api/src/health/health.controller.ts` | **API-T07** `health.controller.spec.ts` (200 khi DB up, 503 khi DB down); smoke test `curl .../health` · **INT-T01** (`/health` với DB thật) · smoke test sau deploy trong `.github/workflows/cd.yml` |
| **NFR-05** Tính sẵn sàng | ADR-004 · Task3_2_Deployment (health check, rollback) | `.github/workflows/cd.yml` (smoke test `/health`, `/products`, CORS; rollback khi lỗi); `docs/deployment.md` | Smoke test sau mỗi lần deploy trong CD · **INT-T01** |
| **NFR-06** Secret & log | Task3_2_Deployment (secrets, logs) · architecture.md mục 4 | `.gitignore` (`.env`), `secrets.*` trong `cd.yml`, biến môi trường Render/Vercel/Neon; log NestJS trên Render | Kiểm tra thủ công: không có secret trong repo/log CI |

## 3. Thống kê

- **Test tự động hiện có** – tất cả chạy trong CI (`.github/workflows/ci.yml`):
  - **API-T01 → API-T09**: unit test API (`apps/api/src/**/*.spec.ts`, `npm run test`).
  - **INT-T01 → INT-T07**: integration test HTTP + PostgreSQL thật (`tests/api`, `npm run test:e2e:api`).
  - **WEB-T01 → WEB-T04**: unit/component test frontend (`tests/web`, `npm run test:web`).
  - **E2E-T01**: Playwright menu → giỏ → đăng nhập → thanh toán → xác nhận đơn → lịch sử (`tests/e2e`, `npm run test:e2e`).
- **Còn thiếu**: test tự động đo hiệu năng p95 (NFR-01), kiểm thử responsive tự động (NFR-03).
- **Quy tắc**: mọi PR mới bổ sung code phải cập nhật ma trận này (theo Definition of Done – README mục 9.3).
