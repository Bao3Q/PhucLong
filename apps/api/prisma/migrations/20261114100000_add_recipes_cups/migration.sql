-- Thêm Cup (tồn kho ly S/M/L) và RecipeItem (công thức nguyên liệu của từng món
-- theo size). Seed lại menu 4 món cà phê: Cappuccino, Bạc Xỉu, Cà Phê Sữa Đá,
-- Cà Phê Đen. Viết idempotent để chạy lại an toàn.

SET client_encoding TO 'UTF8';

-- =============================================================================
-- 1. Bảng Cup (tồn kho ly theo size)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Cup" (
    "id"        SERIAL       NOT NULL,
    "size"      "ProductSize" NOT NULL,
    "quantity"  INTEGER      NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Cup_size_key" UNIQUE ("size"),
    CONSTRAINT "Cup_quantity_check" CHECK ("quantity" >= 0)
);

COMMENT ON TABLE "Cup" IS
    'Tồn kho ly theo size, trừ mỗi lần thanh toán thành công.';

-- =============================================================================
-- 2. Bảng RecipeItem (công thức: nguyên liệu cho 1 ly theo size)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "RecipeItem" (
    "id"           SERIAL        NOT NULL,
    "productId"    TEXT          NOT NULL,
    "size"         "ProductSize" NOT NULL,
    "ingredientId" INTEGER       NOT NULL,
    "amount"       NUMERIC(10,2) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecipeItem_productId_size_ingredientId_key"
        UNIQUE ("productId", "size", "ingredientId"),
    CONSTRAINT "RecipeItem_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "RecipeItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeItem_ingredientId_fkey"
        FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE "RecipeItem" IS
    'Lượng nguyên liệu cần dùng cho 1 ly của một món theo size.';

CREATE INDEX IF NOT EXISTS "RecipeItem_productId_size_idx"
    ON "RecipeItem" ("productId", "size");

-- =============================================================================
-- 3. Trigger updatedAt cho Cup
-- =============================================================================

DROP TRIGGER IF EXISTS "Cup_set_updated_at" ON "Cup";
CREATE TRIGGER "Cup_set_updated_at"
    BEFORE UPDATE ON "Cup"
    FOR EACH ROW
    EXECUTE FUNCTION "set_updated_at"();

-- =============================================================================
-- 4. Seed menu 4 món cà phê (khớp SEED_PRODUCTS trong products.data.ts)
-- =============================================================================

INSERT INTO "Product" ("id", "name", "price", "imageUrl", "description", "tag")
VALUES
  ('1', 'Cappuccino Espresso', 45000,
   'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
   'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.', 'BÁN CHẠY'),
  ('2', 'Bạc Xỉu', 40000,
   'https://images.unsplash.com/photo-1541167760496-1628856ab776?w=500&auto=format&fit=crop&q=60',
   'Nhiều sữa, ít cà phê — ngọt béo nhẹ nhàng, đậm chất Sài Gòn xưa.', NULL),
  ('3', 'Cà Phê Sữa Đá', 35000,
   'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
   'Hạt Robusta đậm đà rang mộc hòa quyện cùng sữa đặc truyền thống.', NULL),
  ('4', 'Cà Phê Đen', 30000,
   'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=500&auto=format&fit=crop&q=60',
   'Robusta rang mộc pha phin truyền thống, đậm đà thuần khiết.', NULL)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Product" SET
  "name" = 'Cappuccino Espresso',
  "price" = 45000,
  "imageUrl" = 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
  "description" = 'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.',
  "tag" = 'BÁN CHẠY'
WHERE "id" = '1';

UPDATE "Product" SET
  "name" = 'Bạc Xỉu',
  "price" = 40000,
  "imageUrl" = 'https://images.unsplash.com/photo-1541167760496-1628856ab776?w=500&auto=format&fit=crop&q=60',
  "description" = 'Nhiều sữa, ít cà phê — ngọt béo nhẹ nhàng, đậm chất Sài Gòn xưa.',
  "tag" = NULL
WHERE "id" = '2';

UPDATE "Product" SET
  "name" = 'Cà Phê Sữa Đá',
  "price" = 35000,
  "imageUrl" = 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
  "description" = 'Hạt Robusta đậm đà rang mộc hòa quyện cùng sữa đặc truyền thống.',
  "tag" = NULL
WHERE "id" = '3';

UPDATE "Product" SET
  "name" = 'Cà Phê Đen',
  "price" = 30000,
  "imageUrl" = 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=500&auto=format&fit=crop&q=60',
  "description" = 'Robusta rang mộc pha phin truyền thống, đậm đà thuần khiết.',
  "tag" = NULL
WHERE "id" = '4';

-- =============================================================================
-- 5. Seed tồn kho ly: S=100, M=150, L=80
-- =============================================================================

INSERT INTO "Cup" ("size", "quantity")
VALUES ('S', 100), ('M', 150), ('L', 80)
ON CONFLICT ("size") DO NOTHING;

-- =============================================================================
-- 6. Seed công thức (chỉ Đường, Sữa, Cà phê — lượng cho 1 ly)
--    Cột: productId, size, nguyên liệu, amount
-- =============================================================================

INSERT INTO "RecipeItem" ("productId", "size", "ingredientId", "amount")
VALUES
  -- 1. Cappuccino: Cà phê 15/18/20g, Sữa 100/120/150ml, Đường 10/12/15g
  ('1', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 15),
  ('1', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 18),
  ('1', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 20),
  ('1', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    100),
  ('1', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    120),
  ('1', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    150),
  ('1', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  10),
  ('1', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  12),
  ('1', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  15),

  -- 2. Bạc Xỉu: Cà phê 10/12/15g, Sữa 120/150/180ml, Đường 20/25/30g
  ('2', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 10),
  ('2', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 12),
  ('2', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 15),
  ('2', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    120),
  ('2', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    150),
  ('2', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    180),
  ('2', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  20),
  ('2', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  25),
  ('2', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  30),

  -- 3. Cà Phê Sữa Đá: Cà phê 15/18/20g, Sữa 60/80/100ml, Đường 10/15/20g
  ('3', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 15),
  ('3', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 18),
  ('3', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 20),
  ('3', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    60),
  ('3', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    80),
  ('3', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Sữa'),    100),
  ('3', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  10),
  ('3', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  15),
  ('3', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  20),

  -- 4. Cà Phê Đen: Cà phê 15/18/20g, Đường 5/8/10g (không sữa)
  ('4', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 15),
  ('4', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 18),
  ('4', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Cà phê'), 20),
  ('4', 'S', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  5),
  ('4', 'M', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  8),
  ('4', 'L', (SELECT id FROM "Ingredient" WHERE name = 'Đường'),  10)
ON CONFLICT ("productId", "size", "ingredientId") DO NOTHING;
