## Context

Tiếp nối kế hoạch trừ kho khi thanh toán (user đã chốt: thiếu kho → chặn thanh toán; không trừ topping). Yêu cầu mới bổ sung: **chỉ dùng 3 nguyên liệu có sẵn (Đường, Sữa, Cà phê) — không thêm nguyên liệu mới**, và **menu đổi thành 4 món cà phê**: Cappuccino, Bạc Xỉu, Cà Phê Sữa (Đá), Cà Phê Đen.

Hiện trạng cần biết: menu web đọc từ **in-memory** `SEED_PRODUCTS` trong API (không đọc bảng Product), bảng `Product` trong DB chỉ dùng khi order ghi nhận (connectOrCreate id '1'–'4'). Web `page.tsx` hardcode category tabs `['Tất cả', 'Trà Sữa', 'Trà Trái Cây', 'Cà Phê']`.

## Thay đổi

### 1. Đổi menu 4 món cà phê — `apps/api/src/products/products.data.ts`
Thay `SEED_PRODUCTS` (giữ nguyên cấu trúc Product/sizes, id 1–4, sizes S/M/L +5k/+10k, category 'Cà Phê'):

| id | Món | Giá gốc | Đặc điểm |
|---|---|---|---|
| 1 | Cappuccino Espresso | 45.000đ | giữ nguyên |
| 2 | Bạc Xỉu | 40.000đ | mới (thay Trà Đào) |
| 3 | Cà Phê Sữa Đá | 35.000đ | giữ nguyên |
| 4 | Cà Phê Đen | 30.000đ | mới |

Ảnh: dùng URL unsplash ảnh cà phê tương ứng. Toppings trong data chỉ giữ 'Shot Espresso thêm' (không liên quan trừ kho).

### 2. Web — `apps/web/app/page.tsx`
Đổi mảng categories thành `['Tất cả', 'Cà Phê']` (bỏ tab trà sữa/trà trái cây không còn món). `ProductModal` giữ nguyên (toggle trân châu/kem hardcode — đã chốt không trừ kho topping).

### 3. Schema — `apps/api/prisma/schema.prisma`
- Thêm `recipeItems RecipeItem[]` vào `Product` và `Ingredient`
- Model mới `Cup`: `id`, `size ProductSize @unique`, `quantity Int @default(0)`, `updatedAt`
- Model mới `RecipeItem`: `id`, `productId String`, `size ProductSize`, `ingredientId Int`, `amount Decimal(10,2)`, relations tới `Product`/`Ingredient` (Cascade), `@@unique([productId, size, ingredientId])`

### 4. Migration + seed — `apps/api/prisma/migrations/20261114100000_add_recipes_cups/migration.sql`
Viết tay idempotent theo style migration hiện có (`ON CONFLICT DO NOTHING`):
- Bảng `Cup`, `RecipeItem`
- Đảm bảo Product '1'–'4' tồn tại (INSERT ... ON CONFLICT DO NOTHING) rồi UPDATE tên/giá/mô tả theo menu mới
- Seed ly: **S=100, M=150, L=80**
- Seed công thức (chỉ Đường/Sữa/Cà phê, g/ml mỗi ly):

| Món (id) | Cà phê (g) | Sữa (ml) | Đường (g) |
|---|---|---|---|
| 1 Cappuccino | 15/18/20 | 100/120/150 | 10/12/15 |
| 2 Bạc Xỉu | 10/12/15 | 120/150/180 | 20/25/30 |
| 3 Cà Phê Sữa Đá | 15/18/20 | 60/80/100 | 10/15/20 |
| 4 Cà Phê Đen | 15/18/20 | — | 5/8/10 |

### 5. Trừ kho khi thanh toán — `apps/api/src/payments/payments.service.ts`
Trong `processPayment`, bọc trong `this.prisma.$transaction(async (tx) => {...})`:
- Gom nhu cầu theo (productId, size), đọc `RecipeItem`
- Trừ nguyên liệu có điều kiện `updateMany({ where: { id, quantity: { gte: amount*qty } }, data: { quantity: { decrement } } })` — `count === 0` → `BadRequestException` (kể tên nguyên liệu thiếu) → rollback, thanh toán thất bại
- Trừ ly theo size: tương tự với `tx.cup.updateMany`
- Món không có công thức → bỏ qua trừ nguyên liệu, vẫn trừ ly (defensive)
- Trong cùng transaction: `ordersService.updateStatus(order.id, 'PAID', tx)` + `tx.payment.create(...)`

### 6. `apps/api/src/orders/orders.service.ts`
`updateStatus(id, status, tx?)` — thêm tham số optional `tx: Prisma.TransactionClient`, mặc định `this.prisma`.

### 7. Xem tồn kho — `apps/api/src/inventory/inventory.controller.ts` (mới)
`GET /inventory` trả `{ ingredients, cups }`, đăng ký trong `AppModule` — dùng verify/demo.

### 8. Tests — `apps/api/src/payments/payments.service.spec.ts`
Cập nhật mock prisma (`$transaction` chạy callback với tx mock, `ingredient/cup.updateMany`, `order.update`); thêm test trừ đúng kho và test chặn khi thiếu.

### 9. Chạy `graphify update .` sau khi sửa code.

## Verification
1. `npm test` — pass
2. `docker compose restart app` — tự chạy lại `prisma generate && prisma migrate deploy`
3. Query DB: 3 dòng Cup, 34 dòng RecipeItem (4 món × 3 size × nguyên liệu), Product 1–4 đúng tên/giá mới
4. `GET /products` trả đúng 4 món cà phê; web home chỉ còn tab 'Tất cả'/'Cà Phê'
5. E2E: login → đặt Cà Phê Sữa M x1 → thanh toán → `GET /inventory`: Cà phê −18g, Sữa −80ml, Đường −15g, ly M −1. Đặt đến khi hết ly M → bị chặn với thông báo rõ ràng