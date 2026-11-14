# Ma trận truy vết (Traceability Matrix)

> Truy vết từ mã yêu cầu (SRS) → use-case/story → thiết kế → code/API → test. Các file test và code đều là đường dẫn thật trong repo; phần chưa hoàn thành ghi rõ `—` kèm ghi chú.

## 1. Yêu cầu chức năng (FR)

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test |
| --- | --- | --- | --- | --- |
| **FR-01** Xem menu | US-01 Xem menu danh mục | Task2_3_Class (Product) · Task1_2_UseCase UC01 | `GET /products`, `GET /products/:id` — `apps/api/src/products/products.controller.ts`; UI menu: `apps/web/app/page.tsx` | **API-T01** `products.service.spec.ts` · **API-T06** `products.rbac.spec.ts` |
| **FR-02** Chi tiết món, size/topping | US-02 Chọn tùy chọn món | Task1_2_UseCase UC02 · Task2_1_Activity (nhánh chọn món) | `apps/web/components/ProductModal.tsx`; loại `ProductOption`, `CartItem` — `apps/web/app/types/index.ts` | Kiểm thử thủ công UI (AC-05) · E2E — *đang bổ sung Task 5.2* |
| **FR-03** Quản lý giỏ hàng | US-03 Giỏ hàng & tổng tiền | Task1_2_UseCase UC03 | `apps/web/app/checkout/page.tsx`; lưu `localStorage("phuclong_cart")` — `apps/web/app/page.tsx` | Kiểm thử thủ công UI · E2E — *đang bổ sung Task 5.2* |
| **FR-04** Đăng ký / đăng nhập JWT | US-04 Xác thực | Task2_3_Class (User) | `POST /auth/register`, `POST /auth/login` — `apps/api/src/auth/auth.controller.ts`; client: `apps/web/lib/auth.ts` | **API-T02** `auth.service.spec.ts` · **API-T05** `jwt-auth.guard.spec.ts` |
| **FR-05** Tạo đơn hàng | UC-01 Đặt và thanh toán | Task2_2_Sequence (tạo đơn) · Task2_1_Activity | `POST /orders` (JwtAuthGuard) — `apps/api/src/orders/orders.controller.ts`, `orders.service.ts` | **API-T03** `orders.service.spec.ts` (persist + items, từ chối giỏ rỗng) · AC-01 qua `jwt-auth.guard.spec.ts` |
| **FR-06** Thanh toán Ví/Thẻ mô phỏng | UC-01 (bước 6–7) | Task2_2_Sequence (alt thành công/thất bại, idempotency) · ADR-003 | `POST /payments`, `GET /payments/:orderId` — `apps/api/src/payments/payments.service.ts` | **API-T04** `payments.service.spec.ts` (idempotency, trừ kho trong transaction, hết ly/nguyên liệu, đã PAID) |
| **FR-07** Trạng thái & chi tiết đơn | US-05 Theo dõi đơn | Task2_1_Activity (theo dõi) | `GET /orders/:id` — `orders.service.ts`; UI: `apps/web/app/order-success/page.tsx` | **API-T03** `orders.service.spec.ts` (load đơn, 404 khi không tồn tại). ⚠️ API list đơn theo user + trang lịch sử — *chưa làm* |
| **FR-08** Khuyến mãi (Could) | US-06 Nhập mã giảm giá | Task2_3_Class (Promotion) | Model `Promotion`, `Order.voucherCode` — `apps/api/prisma/schema.prisma` | — *chưa có endpoint/UI/test (mức Could, trong kế hoạch sau 5 task bắt buộc)* |

## 2. Yêu cầu phi chức năng (NFR)

| Mã yêu cầu | Thiết kế / Quyết định | Code / Cấu hình | Test / Kiểm chứng |
| --- | --- | --- | --- |
| **NFR-01** Hiệu năng (< 500ms p95) | ADR-004 (region Neon/Render) | `GET /products` trả dữ liệu nhỏ, in-memory seed | Đo thủ công; chưa có test tự động đo p95 |
| **NFR-02** Bảo mật JWT | ADR-002 · Task2_2_Sequence (kiểm tra JWT) | `apps/api/src/common/auth/jwt-auth.guard.ts`; guard trên `POST /orders`; RBAC ADMIN `POST /products` | **API-T05** `jwt-auth.guard.spec.ts` · **API-T06** `products.rbac.spec.ts` |
| **NFR-03** Mobile-first ≥ 360px | architecture.md mục 2 | Tailwind responsive — `apps/web/app/page.tsx`, `checkout/page.tsx` | Kiểm thử thủ công responsive |
| **NFR-04** Docker + health check | ADR-002 · ADR-004 | `Dockerfile`, `docker-compose.yml` (postgres healthcheck, `migrate deploy`); `GET /health` — `apps/api/src/health/health.controller.ts` | **API-T07** `health.controller.spec.ts` (200 khi DB up, 503 khi DB down); smoke test `curl .../health` |

## 3. Thống kê

- **Test tự động hiện có** (7 suites, 60 test — `npm test`): API-T01 → API-T07 như trên.
- **Thiếu (đã lên kế hoạch Task 5.2)**: integration test tạo đơn → thanh toán trên HTTP thật (supertest), E2E luồng menu → xác nhận đơn (FR-02/FR-03/AC-05), API list đơn theo user (FR-07), luồng khuyến mãi (FR-08).
- **Quy tắc**: mọi PR mới bổ sung code phải cập nhật ma trận này (theo DoD mục 2.3 README).
