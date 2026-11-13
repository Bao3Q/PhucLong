# Task 7 – Đăng ký / Đăng nhập (JWT)

Theo đề: `POST /auth/register`, `POST /auth/login`; băm mật khẩu bằng bcrypt; phát JWT; guard bảo vệ route đặt đơn.

| Method | Endpoint | Quyền | Kết quả |
| :-- | :-- | :-- | :-- |
| POST | `/auth/register` | Công khai | 201 + user (luôn role `CUSTOMER`); 409 trùng email; 400 dữ liệu sai |
| POST | `/auth/login` | Công khai | 200 + `accessToken` (JWT HS256, 1 giờ); 401 sai email/mật khẩu |
| POST | `/orders` | Có JWT | 201; không có / sai token → 401 |
| GET | `/products`, `/products/:id` | Công khai | Xem menu |
| POST / PATCH / DELETE | `/products`, `/products/:id` | **ADMIN** | 401 chưa đăng nhập; 403 với CUSTOMER |

- Mật khẩu băm bằng bcrypt; JWT ký bằng `JWT_SECRET` (đặt trong `.env`).
- Guard: `JwtAuthGuard` (xác thực), `RolesGuard` + `@Roles('ADMIN')` (phân quyền) – cùng cách làm với đồ án Maycha.
- Tài khoản ADMIN có sẵn (lấy từ `prisma/schema.sql`): `admin@maycha.vn` / `Admin@123456`.
- Kho user hiện lưu trong bộ nhớ, khởi động lại API sẽ mất user đã đăng ký.
- Web: trang `/login` (đăng nhập / đăng ký) lưu token ở `localStorage` (`accessToken`); trang thanh toán gửi `Authorization: Bearer <token>` khi tạo đơn, chưa đăng nhập thì chuyển sang `/login`.
- Test: `cd apps/api && npm test`.
