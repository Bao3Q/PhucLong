-- Seed dữ liệu: mô tả sản phẩm sẵn có, 3 nguyên liệu cơ bản, voucher mẫu.
-- Idempotent: chạy lại không tạo bản ghi trùng.

SET client_encoding TO 'UTF8';

-- =============================================================================
-- 1. Bổ sung description cho các sản phẩm đã có trong database
-- =============================================================================

UPDATE "Product" SET "description" = 'Hồng trà đậm vị kết hợp bí đao mát lạnh, giải nhiệt hiệu quả'
WHERE "id" = '1' AND "description" IS NULL;

UPDATE "Product" SET "description" = 'Trà đào tươi hòa quyện cùng cam sả thơm mát, chua ngọt dễ uống'
WHERE "id" = '2' AND "description" IS NULL;

UPDATE "Product" SET "description" = 'Espresso đậm đà pha cùng sữa tươi, vị đắng ngọt cân bằng'
WHERE "id" = '3' AND "description" IS NULL;

UPDATE "Product" SET "description" = 'Cappuccino chuẩn Ý với lớp foam sữa mịn màng'
WHERE "id" = '4' AND "description" IS NULL;

-- =============================================================================
-- 2. Ba nguyên liệu cơ bản: đường, sữa, cà phê
-- =============================================================================

INSERT INTO "Ingredient" ("name", "quantity", "unit")
VALUES
  ('Đường',  5000,  'g'),
  ('Sữa',    10000, 'ml'),
  ('Cà phê', 3000,  'g')
ON CONFLICT ("name") DO NOTHING;

-- =============================================================================
-- 3. Voucher mẫu dùng cho /promotions/validate
-- =============================================================================

INSERT INTO "Promotion" ("code", "name", "description", "discountType", "discountValue",
                         "maxDiscountAmount", "minOrderAmount", "usageLimit", "isActive")
VALUES
  ('WELCOME10',
   'Giảm 10% đơn đầu tiên',
   'Giảm 10% tối đa 20.000đ cho đơn từ 50.000đ',
   'PERCENT', 10, 20000, 50000, 1000, TRUE)
ON CONFLICT ("code") DO NOTHING;
