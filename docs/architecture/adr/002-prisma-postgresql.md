# ADR-002: Prisma ORM + PostgreSQL, migration forward-only

- **Trạng thái**: Accepted
- **Ngày**: 2026-11-14

## Bối cảnh

Đề bài bắt buộc PostgreSQL. Cần chọn ORM và cơ chế migration tái tạo được database (`docker-compose up` phải chạy được từ trắng). Prisma 7 yêu cầu driver adapter để nối PostgreSQL.

## Quyết định

- Dùng **Prisma** làm ORM, schema tại `apps/api/prisma/schema.prisma` là **nguồn sự thật duy nhất** của mô hình dữ liệu (User, Product, Order, OrderItem, Payment, Promotion, LoyaltyTransaction, Ingredient, Cup, RecipeItem).
- Nối DB qua driver adapter **`@prisma/adapter-pg`** trong `PrismaService` (global module).
- Migration theo hướng **forward-only** (`prisma migrate deploy`): không viết down migration; rollback schema = khôi phục backup Neon hoặc `prisma migrate resolve`.

## Hệ quả

- ✅ `prisma generate` chạy tự động trong `prebuild`/`pretest` — type-safe cho cả orders/payments service.
- ✅ `docker-compose` tự chạy `migrate deploy` khi khởi động; Render đặt làm **Pre-Deploy Command** — deploy lặp lại được.
- ⚠️ Không có down migration — quy trình rollback phải dựa backup DB (đã ghi trong README mục 7.3).
- ⚠️ Prisma client sinh ra nằm trong `src/generated/` — file lớn, đã đưa vào .gitignore đúng chuẩn Prisma 7.
