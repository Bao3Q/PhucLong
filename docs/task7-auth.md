# 5. Task 7 – Đăng ký / Đăng nhập (JWT) & Phân quyền

| Method | Endpoint | Quyền | Kết quả |
| :-- | :-- | :-- | :-- |
| POST | `/auth/register` | Công khai | 201 + user (luôn role `CUSTOMER`), 409 trùng email, 400 dữ liệu sai |
| POST | `/auth/login` | Công khai | 200 + `accessToken` (JWT HS256), 401 sai email/mật khẩu |
| GET | `/auth/me` | Có JWT | 200 + user hiện tại, 401 nếu thiếu/sai token |
| GET | `/products`, `/products/:id` | Công khai | Xem menu |
| POST | `/products` | **ADMIN** | 201; không JWT → 401; CUSTOMER → 403 |
| PATCH | `/products/:id` | **ADMIN** | 200 / 404; không JWT → 401; CUSTOMER → 403 |
| DELETE | `/products/:id` | **ADMIN** | 200 / 404; không JWT → 401; CUSTOMER → 403 |

- Mật khẩu băm bằng **bcrypt**, JWT ký HS256 bằng `JWT_SECRET`, thời hạn theo `JWT_EXPIRATION` (mặc định 1 giờ).
- Guard: `JwtAuthGuard` (xác thực) + `RolesGuard` với `@Roles('ADMIN')` (phân quyền). Route đặt đơn (Task 6) chỉ cần `@UseGuards(JwtAuthGuard)`.
- Tài khoản ADMIN tạo sẵn khi API chạy: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (mặc định dev `admin@phuclong.vn` / `Admin@123456`). Đăng ký công khai không thể tự tạo ADMIN.
- Kho user hiện lưu trong bộ nhớ (giống `ProductsService`), khởi động lại API sẽ mất user đã đăng ký.
- Test: `cd apps/api && npm test` (unit bcrypt/JWT/guard + e2e phân quyền 401/403/200).

Thử nhanh bằng curl:

```bash
# 1. Đăng nhập admin lấy token
curl -X POST http://localhost:4000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@phuclong.vn","password":"Admin@123456"}'

# 2. Thêm sản phẩm (thay <TOKEN>)
curl -X POST http://localhost:4000/products -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Trà Đào","category":"Trà Trái Cây","basePrice":39000,"image":"https://example.com/a.jpg"}'
```
