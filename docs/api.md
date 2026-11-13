# BrewLite – API Contract

> Base URL: `http://localhost:3001/api/v1` (dev)  
> Production: `https://<api-domain>/api/v1`  
> Swagger (dev): `http://localhost:3001/api/docs`

## 1. Quy ước chung

### 1.1. Auth

Các API cần đăng nhập dùng header:

```http
Authorization: Bearer <accessToken>
```

JWT payload gợi ý:

```json
{
  "sub": "user-id",
  "email": "customer@example.com",
  "role": "CUSTOMER"
}
```

Role: `CUSTOMER`, `ADMIN`.

### 1.2. Content type

```http
Content-Type: application/json
```

### 1.3. Tiền tệ

Tất cả giá trị tiền là **VND**, kiểu `number` (integer), ví dụ `45000`.

### 1.4. Phân trang

Query:

```http
?page=1&limit=20
```

Response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### 1.5. Error format

```json
{
  "statusCode": 409,
  "code": "EMAIL_ALREADY_EXISTS",
  "message": "Email đã được sử dụng",
  "path": "/api/v1/auth/register",
  "timestamp": "2026-11-12T10:00:00.000Z"
}
```

Các mã thường dùng:

| HTTP | Ý nghĩa |
|---|---|
| 400 | Dữ liệu sai / thiếu field |
| 401 | Chưa đăng nhập / token hết hạn |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 409 | Xung đột: email trùng, hết hàng, sai trạng thái |
| 422 | Vi phạm nghiệp vụ: voucher hết hạn, không đủ điểm |
| 500 | Lỗi server |

---

## 2. Danh sách endpoint

### 2.1. System

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| GET | `/health` | Public | Health check + kiểm tra DB | P0 |

### 2.2. Auth

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| POST | `/auth/register` | Public | Đăng ký | P0 |
| POST | `/auth/login` | Public | Đăng nhập, trả JWT | P0 |
| GET | `/auth/me` | User | Thông tin user hiện tại | P0 |
| PATCH | `/auth/me` | User | Cập nhật thông tin (nếu cần) | P2 |
| POST | `/auth/refresh` | Public | Refresh token | P2 |
| POST | `/auth/logout` | User | Logout / thu hồi token | P2 |

### 2.3. Products

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| GET | `/products` | Public | Danh sách menu, search + phân trang | P0 |
| GET | `/products/:id` | Public | Chi tiết sản phẩm | P0 |
| POST | `/products` | Admin | Tạo sản phẩm | P1 |
| PATCH | `/products/:id` | Admin | Cập nhật sản phẩm | P1 |
| DELETE | `/products/:id` | Admin | Xóa sản phẩm | P2 |

### 2.4. Ingredients

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| GET | `/ingredients` | Admin | Danh sách nguyên liệu | P1 |
| POST | `/ingredients` | Admin | Thêm nguyên liệu | P1 |
| PATCH | `/ingredients/:id` | Admin | Sửa số lượng/đơn vị | P1 |
| DELETE | `/ingredients/:id` | Admin | Xóa nguyên liệu | P2 |

### 2.5. Promotions

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| POST | `/promotions/validate` | User | Kiểm tra và tính giảm giá | P1 |
| GET | `/promotions` | Admin | Danh sách voucher | P1 |
| POST | `/promotions` | Admin | Tạo voucher | P1 |
| PATCH | `/promotions/:id` | Admin | Sửa voucher | P1 |
| DELETE | `/promotions/:id` | Admin | Xóa / khóa voucher | P2 |

### 2.6. Orders

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| POST | `/orders` | Customer | Tạo đơn hàng | P0 |
| GET | `/orders` | Customer | Đơn hàng của tôi | P0 |
| GET | `/orders/:id` | Owner/Admin | Chi tiết đơn | P0 |
| PATCH | `/orders/:id/cancel` | Owner | Hủy đơn PENDING/PAYMENT_FAILED | P1 |
| GET | `/admin/orders` | Admin | Tất cả đơn, filter trạng thái | P1 |
| PATCH | `/admin/orders/:id/status` | Admin | Chuyển trạng thái đơn | P1 |

### 2.7. Payments

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| POST | `/payments` | Customer | Tạo thanh toán (idempotent) | P0 |
| GET | `/payments/:id` | Owner/Admin | Trạng thái thanh toán | P0 |
| POST | `/payments/:id/retry` | Owner | Thử lại thanh toán | P2 |
| POST | `/payments/webhook/mock` | Internal | Webhook giả lập | P2 |

### 2.8. Loyalty

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| GET | `/loyalty/transactions` | Customer | Lịch sử cộng/trừ điểm | P1 |
| POST | `/loyalty/redeem` | Customer | Đổi điểm (nếu làm) | P2 |

### 2.9. Admin extras

| Method | Path | Auth | Mô tả | Ưu tiên |
|---|---|---|---|---|
| GET | `/admin/users` | Admin | Danh sách user | P2 |
| GET | `/admin/stats` | Admin | Thống kê doanh thu/đơn | P2 |

---

## 3. Chi tiết các API chính

### 3.1. `GET /health`

Response `200`:

```json
{
  "status": "ok",
  "db": "up",
  "uptime": 123.45,
  "timestamp": "2026-11-12T10:00:00.000Z"
}
```

---

### 3.2. `POST /auth/register`

Request:

```json
{
  "email": "customer@example.com",
  "password": "Customer@123"
}
```

Validate:

- Email đúng định dạng, chưa tồn tại.
- Password tối thiểu 8 ký tự.

Response `201`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "user": {
    "id": "c1a2...",
    "email": "customer@example.com",
    "role": "CUSTOMER",
    "loyaltyPoints": 0,
    "createdAt": "2026-11-12T10:00:00.000Z"
  }
}
```

Lỗi:

- `409 EMAIL_ALREADY_EXISTS`

---

### 3.3. `POST /auth/login`

Request:

```json
{
  "email": "admin@maycha.vn",
  "password": "Admin@123456"
}
```

Response `200`: giống register.

Lỗi:

- `401 INVALID_CREDENTIALS`

---

### 3.4. `GET /auth/me`

Response `200`:

```json
{
  "id": "c1a2...",
  "email": "customer@example.com",
  "role": "CUSTOMER",
  "loyaltyPoints": 35,
  "createdAt": "2026-11-12T10:00:00.000Z"
}
```

---

### 3.5. `GET /products`

Query:

```http
GET /products?search=trà&page=1&limit=20
```

Response `200`:

```json
{
  "data": [
    {
      "id": "p-tra-sua",
      "name": "Trà Sữa Phúc Long",
      "price": 45000,
      "imageUrl": "https://...",
      "description": "Trà đậm vị truyền thống",
      "tag": "BÁN CHẠY",
      "stock": 20
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

> **Lưu ý:** frontend hiện tại đang dùng `id: number`, `basePrice`, `image`.
> API/DB dùng `id: string`, `price`, `imageUrl` (cột `description`, `tag` đã có trong DB).
> Cần đổi type/frontend mapping: `id` → `string`, `basePrice` → `price`, `image` → `imageUrl`.

---

### 3.6. `GET /products/:id`

Response `200`: một object product như trên.

Lỗi: `404 PRODUCT_NOT_FOUND`.

---

### 3.7. `POST /orders`

Request:

```json
{
  "items": [
    {
      "productId": "p-tra-sua",
      "size": "M",
      "toppings": ["TRÂN CHÂU", "KEM"],
      "qty": 2,
      "note": "ít ngọt"
    }
  ],
  "voucherCode": "WELCOME10",
  "pointsToRedeem": 0
}
```

Quy tắc server:

1. Không tin `unitPrice`/`total` từ client.
2. `unitPrice = product.price + sizeAdjustment + toppingTotal`.
   - Size: `S = 0`, `M = +5000`, `L = +10000`.
   - Topping: `TRÂN CHÂU = +5000`, `KEM = +5000`.
3. `lineTotal = unitPrice * qty`.
4. `subtotal = sum(lineTotal)`.
5. Validate voucher → `discountAmount`.
6. `total = subtotal - discountAmount - pointsDiscount`.
7. Transaction:
   - Khóa/kiểm tra tồn kho.
   - Insert `Order` + `OrderItem`.
   - Trừ `Product.stock`.
   - Tăng `Product.version`.

Response `201`:

```json
{
  "id": 1042,
  "status": "PENDING",
  "subtotal": 110000,
  "discountAmount": 11000,
  "voucherCode": "WELCOME10",
  "total": 99000,
  "createdAt": "2026-11-12T10:00:00.000Z",
  "items": [
    {
      "id": 1,
      "productId": "p-tra-sua",
      "productName": "Trà Sữa Phúc Long",
      "size": "M",
      "toppings": ["TRÂN CHÂU", "KEM"],
      "qty": 2,
      "unitPrice": 55000,
      "lineTotal": 110000
    }
  ]
}
```

Lỗi:

- `404 PRODUCT_NOT_FOUND`
- `409 OUT_OF_STOCK`
- `400 INVALID_SIZE_OR_TOPPING`
- `422 INVALID_VOUCHER`
- `422 NOT_ENOUGH_POINTS`

> **Đã có cột `note`** trong `OrderItem` — gửi `note` trong item nếu người dùng nhập.

---

### 3.8. `GET /orders`

Query:

```http
GET /orders?page=1&limit=10&status=PAID
```

Response `200`:

```json
{
  "data": [
    {
      "id": 1042,
      "status": "PAID",
      "subtotal": 110000,
      "discountAmount": 11000,
      "total": 99000,
      "itemCount": 2,
      "createdAt": "2026-11-12T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

Chỉ trả đơn của user trong JWT. Admin dùng `/admin/orders`.

---

### 3.9. `GET /orders/:id`

Response `200`: order đầy đủ gồm `items`, `payments`, trạng thái hiện tại.

Chỉ owner hoặc admin được xem.

---

### 3.10. `PATCH /orders/:id/cancel`

Không cần body hoặc:

```json
{ "reason": "Đổi ý" }
```

Chỉ cho phép khi status là `PENDING` hoặc `PAYMENT_FAILED`.

Server:

- Set `CANCELLED`.
- Hoàn tồn kho.
- Nếu đã thanh toán → chỉ admin được hủy/refund.

---

### 3.11. `PATCH /admin/orders/:id/status`

Request:

```json
{ "status": "PREPARING" }
```

Luồng trạng thái hợp lệ:

```text
PENDING ──► PAID ──► PREPARING ──► READY ──► COMPLETED
   │           │
   ├──► PAYMENT_FAILED
   └──► CANCELLED
```

Lỗi: `409 INVALID_STATUS_TRANSITION`.

Khi `COMPLETED` (hoặc `PAID` nếu chọn cộng sớm):

- Cộng điểm: `floor(total / 10000)` điểm.
- Insert `LoyaltyTransaction` type `EARN`.
- Cập nhật `User.loyaltyPoints`.
- Unique index `LoyaltyTransaction_orderId_earn_key` chống cộng trùng.

---

### 3.12. `POST /payments`

Header:

```http
Idempotency-Key: 7b1f5c2e-...
```

Request:

```json
{
  "orderId": 1042,
  "method": "WALLET"
}
```

`method`: `WALLET` (MoMo/ZaloPay) hoặc `CARD`.

Response `201`:

```json
{
  "id": 501,
  "orderId": 1042,
  "amount": 99000,
  "method": "WALLET",
  "status": "SUCCESS",
  "transactionRef": "MOCK-1723456789",
  "paidAt": "2026-11-12T10:00:05.000Z"
}
```

Quy tắc:

- Kiểm tra order thuộc user, status `PENDING` hoặc `PAYMENT_FAILED`.
- `amount` lấy từ `Order.total`, không lấy từ client.
- Nếu `Idempotency-Key` đã tồn tại → trả lại payment cũ, không tạo mới.
- Transaction khi success:
  - `Payment.status = SUCCESS`, set `paidAt`, `transactionRef`.
  - `Order.status = PAID`.
  - Cộng điểm + `LoyaltyTransaction` nếu chọn cộng ở bước này.
- Khi fail:
  - `Payment.status = FAILED`, `failureReason`.
  - `Order.status = PAYMENT_FAILED`.

Mock provider:

- Mặc định `WALLET`/`CARD` đều success.
- Để test fail, cho phép body `simulateResult: "FAILED"` khi `PAYMENT_MOCK_MODE=true` (chỉ dev/test).

Lỗi:

- `409 ORDER_ALREADY_PAID`
- `409 PAYMENT_ALREADY_PROCESSING` (cùng idempotency key đang xử lý)
- `422 ORDER_NOT_PAYABLE`

---

### 3.13. `GET /payments/:id`

Response `200`: trạng thái payment. Dùng để frontend polling sau khi thanh toán.

---

### 3.14. `POST /promotions/validate`

Request:

```json
{
  "code": "WELCOME10",
  "subtotal": 110000
}
```

Response `200`:

```json
{
  "code": "WELCOME10",
  "name": "Giảm 10% đơn đầu",
  "discountType": "PERCENT",
  "discountValue": 10,
  "discountAmount": 11000,
  "total": 99000
}
```

Kiểm tra:

- `isActive = true`.
- `startsAt <= now <= endsAt` (nếu có `endsAt`).
- `usedCount < usageLimit` (nếu có).
- `subtotal >= minOrderAmount`.
- Percent không vượt 100; áp `maxDiscountAmount` nếu có.

> Order creation phải **validate lại voucher** trong transaction, không tin kết quả validate trước đó.

---

### 3.15. `GET /loyalty/transactions`

Query: `?page=1&limit=20`

Response `200`:

```json
{
  "data": [
    {
      "id": 1,
      "orderId": 1042,
      "type": "EARN",
      "points": 9,
      "balanceAfter": 44,
      "description": "Cộng điểm đơn #1042",
      "createdAt": "2026-11-12T10:00:05.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3.16. Ingredient CRUD

`GET /ingredients` response:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Đường",
      "quantity": 5000,
      "unit": "g"
    },
    {
      "id": 2,
      "name": "Sữa",
      "quantity": 10000,
      "unit": "ml"
    },
    {
      "id": 3,
      "name": "Cà phê",
      "quantity": 3000,
      "unit": "g"
    }
  ]
}
```

`POST /ingredients`:

```json
{
  "name": "Trân châu",
  "quantity": 2000,
  "unit": "g"
}
```

`PATCH /ingredients/:id`:

```json
{
  "quantity": 1500
}
```

`unit` gợi ý: `g`, `ml`, `piece`.

> Ingredient hiện là **danh mục tồn kho**, chưa liên kết với Product/Order.
> Nếu muốn trừ nguyên liệu khi bán, cần thêm bảng recipe `ProductIngredient(productId, ingredientId, quantityPerUnit)`.

---

### 3.17. Admin Product CRUD

`POST /products`:

```json
{
  "name": "Trà Đào Trầm Hương",
  "price": 55000,
  "imageUrl": "https://...",
  "stock": 50
}
```

Server tự generate `id` (UUID/cuid) nếu DB chưa có default.

`PATCH /products/:id`:

```json
{
  "price": 60000,
  "stock": 40
}
```

Tăng `version` mỗi lần update để hỗ trợ optimistic locking.

---

## 4. Luồng checkout chuẩn

```text
1. GET  /products                    → lấy menu
2. GET  /products/:id                → xem chi tiết
3. (client) chọn size/topping, lưu cart vào localStorage
4. POST /promotions/validate         → xem trước giảm giá (optional)
5. POST /orders                      → tạo order PENDING, trừ kho
6. POST /payments                    → thanh toán + Idempotency-Key
7. GET  /payments/:id                → polling nếu cần
8. GET  /orders/:id                  → xem trạng thái cuối
9. GET  /loyalty/transactions        → xem điểm được cộng
```

Frontend hiện tại:

- `app/page.tsx` đang dùng `menuProducts` hard-code → thay bằng `GET /products`.
- `ProductModal.tsx` đang tính giá client → vẫn hiển thị được, nhưng server phải tính lại khi tạo order.
- `checkout/page.tsx` nút **Xác nhận trả** đang `router.push('/order-success')` → đổi thành gọi `POST /orders` rồi `POST /payments`, success mới chuyển trang.
- `order-success/page.tsx` đang hard-code `#1042` → đọc `orderId` từ query và gọi `GET /orders/:id`.

---

## 5. Mapping frontend hiện tại → API

| Frontend | API/DB | Việc cần làm |
|---|---|---|
| `Product.id: number` | `id: string` | Đổi type sang `string` |
| `Product.basePrice` | `price` | Đổi type/UI hoặc map ở API client |
| `Product.image` | `imageUrl` | Đổi type/UI hoặc map |
| `Product.description` | `description` (nullable) | Map thẳng |
| `Product.tag` | `tag` (nullable) | Map thẳng, xử lý null |
| `hasTranChau`, `hasKem` | `toppings: string[]` | Map thành `["TRÂN CHÂU", "KEM"]` |
| `note` | `note` | Map thẳng |
| `paymentMethod: 'momo' \| 'card'` | `WALLET \| CARD` | Map `momo → WALLET`, `card → CARD` |
| `totalPrice` tính ở client | server tính lại | Không gửi `unitPrice`/`total` lên server |

---

## 6. Thứ tự implement

### Sprint 1 – P0 tối thiểu

1. `GET /health`
2. `GET /products`
3. `GET /products/:id`
4. Prisma service + exception filter + validation pipe

### Sprint 2 – P0 luồng chính

5. `POST /auth/register`
6. `POST /auth/login`
7. `GET /auth/me`
8. `POST /orders` (transaction + trừ kho)
9. `GET /orders`
10. `GET /orders/:id`
11. `POST /payments` (idempotency + cập nhật order)
12. `GET /payments/:id`

### Sprint 2 – P1 hoàn thiện

13. `POST /promotions/validate`
14. `GET /loyalty/transactions`
15. `PATCH /orders/:id/cancel`
16. `PATCH /admin/orders/:id/status`
17. Admin CRUD: products, ingredients, promotions

### P2 – nếu còn thời gian

18. Refresh token, logout
19. Retry payment, webhook mock
20. Admin users/stats
21. Redeem điểm

---

## 7. Module NestJS gợi ý

```text
apps/api/src/
|-- main.ts
|-- app.module.ts
|-- prisma/
|   |-- prisma.module.ts
|   `-- prisma.service.ts
|-- common/
|   |-- guards/jwt-auth.guard.ts
|   |-- guards/roles.guard.ts
|   |-- decorators/current-user.decorator.ts
|   |-- filters/http-exception.filter.ts
|   `-- interceptors/response.interceptor.ts
|-- health/
|-- auth/
|-- users/
|-- products/
|-- ingredients/
|-- orders/
|-- payments/
|-- promotions/
`-- loyalty/
```

Mỗi module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.

Bật Swagger ở dev:

```text
GET /api/docs
```

---

## 8. Checklist test API

- [ ] Register trùng email → 409
- [ ] Login sai mật khẩu → 401
- [ ] Gọi API protected không token → 401
- [ ] Customer gọi API admin → 403
- [ ] `GET /products` search + phân trang đúng
- [ ] Tạo order khi hết hàng → 409, không trừ kho
- [ ] Tạo order 2 item → subtotal/total đúng
- [ ] Voucher hết hạn/sai mã → 422
- [ ] Thanh toán success → order `PAID`, payment `SUCCESS`
- [ ] Thanh toán fail → order `PAYMENT_FAILED`
- [ ] Gửi lại cùng `Idempotency-Key` → không tạo payment mới
- [ ] Thanh toán đơn đã `PAID` → 409
- [ ] Hủy order PENDING → hoàn kho
- [ ] Admin chuyển trạng thái sai → 409
- [ ] Hoàn tất đơn → cộng điểm đúng, không cộng trùng
- [ ] `GET /health` trả DB `up`
