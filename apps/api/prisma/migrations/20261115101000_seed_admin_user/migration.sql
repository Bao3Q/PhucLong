-- Tài khoản ADMIN mặc định để đăng nhập / thử API (Thunder Client, Postman...).
-- Email    : admin@phuclong.vn
-- Mật khẩu : Admin@123456   (hash bcrypt bên dưới, cost 10)
--
-- Trước đây admin chỉ tồn tại trong bộ nhớ của UsersRepository; giờ user
-- lưu trong PostgreSQL nên cần seed vào DB. Migration idempotent và xử lý
-- đủ 3 trường hợp có thể gặp:
--   1. Email đã tồn tại với id khác  → nâng quyền ADMIN + đặt lại mật khẩu.
--   2. UUID dự phòng bị account khác chiếm (VD DB dùng chung dự án cũ)
--                                      → nhận hẳn row đó làm admin.
--   3. Chưa có gì                    → INSERT mới.
UPDATE "User"
SET "role" = 'ADMIN',
    "passwordHash" = '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56'
WHERE "email" = 'admin@phuclong.vn';

INSERT INTO "User" ("id", "email", "passwordHash", "role", "loyaltyPoints", "createdAt")
SELECT '00000000-0000-4000-8000-000000000001',
       'admin@phuclong.vn',
       '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56',
       'ADMIN',
       0,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE "email" = 'admin@phuclong.vn'
)
ON CONFLICT ("id") DO UPDATE
SET "email" = EXCLUDED."email",
    "role" = 'ADMIN',
    "passwordHash" = EXCLUDED."passwordHash";
