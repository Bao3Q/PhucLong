-- =============================================================================
-- Phúc Long (BrewLite) — SQL bootstrap cho database MỚI (rỗng)
--
-- Vai trò: tạo một database mới từ đầu mà KHỚP 100% với schema.prisma và với
-- kết quả của chuỗi prisma migrations (9 migration trong prisma/migrations/).
--
--   * Phần DDL bên dưới sinh ra bằng `prisma migrate diff --from-empty
--     --to-schema prisma/schema.prisma` nên cấu trúc trùng khớp migrations.
--   * Phần seed khớp dữ liệu seed của các migration + SEED_PRODUCTS
--     (apps/api/src/products/products.data.ts). API cũng tự upsert seed khi
--     khởi động nên dữ liệu luôn hội tụ về đây.
--
-- LƯU Ý:
--   * Chỉ chạy trên database RỖNG, đúng 1 lần: `psql "$DATABASE_URL" -f prisma/schema.sql`
--   * Nâng cấp database ĐÃ CÓ dùng `npx prisma migrate deploy` — đừng chạy lại file này.
--   * Sau bootstrap, khi có migration mới: dùng `prisma migrate resolve --applied <tên>`
--     để baseline, rồi `migrate deploy` như bình thường.
-- =============================================================================
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PAYMENT_FAILED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductSize" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Khác',
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "voucherCode" TEXT,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "size" "ProductSize" NOT NULL,
    "toppings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" INTEGER,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cup" (
    "id" SERIAL NOT NULL,
    "size" "ProductSize" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "size" "ProductSize" NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_active_dates_idx" ON "Promotion"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_voucherCode_idx" ON "Order"("voucherCode");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_idempotencyKey_key" ON "Payment"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx" ON "LoyaltyTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Cup_size_key" ON "Cup"("size");

-- CreateIndex
CREATE INDEX "RecipeItem_productId_size_idx" ON "RecipeItem"("productId", "size");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_productId_size_ingredientId_key" ON "RecipeItem"("productId", "size", "ingredientId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherCode_fkey" FOREIGN KEY ("voucherCode") REFERENCES "Promotion"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- SEED — khớp dữ liệu seed trong các migration + SEED_PRODUCTS
-- =============================================================================

-- Tài khoản ADMIN mặc định để đăng nhập / thử API.
-- Email    : admin@phuclong.vn
-- Mật khẩu : Admin@123456   (hash bcrypt bên dưới, cost 10)
INSERT INTO "User" ("id", "email", "passwordHash", "role", "loyaltyPoints", "createdAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin@phuclong.vn',
  '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56',
  'ADMIN',
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET "role" = 'ADMIN',
    "passwordHash" = EXCLUDED."passwordHash";

-- Menu 4 món cà phê (khớp SEED_PRODUCTS; API upsert lại khi khởi động)
INSERT INTO "Product" ("id", "name", "category", "price", "imageUrl", "description", "tag", "stock", "version")
VALUES
  ('1', 'Cappuccino Espresso', 'Cà Phê', 45000,
   'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=60',
   'Espresso rang đậm phủ lớp bọt sữa nóng mịn mượt chuẩn phong cách Ý.', 'BÁN CHẠY', 50, 0),
  ('2', 'Bạc Xỉu', 'Cà Phê', 40000,
   'https://lypham.vn/wp-content/uploads/2024/09/cach-lam-bac-xiu-da.jpg?w=500&auto=format&fit=crop&q=60',
   'Nhiều sữa, ít cà phê — ngọt béo nhẹ nhàng, đậm chất Sài Gòn xưa.', NULL, 40, 0),
  ('3', 'Cà Phê Sữa Đá', 'Cà Phê', 35000,
   'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=60',
   'Hạt Robusta đậm đà rang mộc hòa quyện cùng sữa đặc truyền thống.', NULL, 30, 0),
  ('4', 'Cà Phê Đen', 'Cà Phê', 30000,
   'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVqi4ea6-SWob0t9eE6zuOSGIf6-ciRZHjw4Bm2BZ-3l8uVsOG9VAXaMk&s=10',
   'Robusta rang mộc pha phin truyền thống, đậm đà thuần khiết.', NULL, 25, 0)
ON CONFLICT ("id") DO NOTHING;

-- Ba nguyên liệu cơ bản
INSERT INTO "Ingredient" ("name", "quantity", "unit")
VALUES
  ('Đường',  5000,  'g'),
  ('Sữa',    10000, 'ml'),
  ('Cà phê', 3000,  'g')
ON CONFLICT ("name") DO NOTHING;

-- Tồn kho ly theo size: S=100, M=150, L=80
INSERT INTO "Cup" ("size", "quantity")
VALUES ('S', 100), ('M', 150), ('L', 80)
ON CONFLICT ("size") DO NOTHING;

-- Công thức (chỉ Đường, Sữa, Cà phê — lượng cho 1 ly theo size)
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

-- Voucher mẫu (schema-only: tính năng promotions chưa có endpoint)
INSERT INTO "Promotion" ("code", "name", "description", "discountType", "discountValue",
                         "maxDiscountAmount", "minOrderAmount", "usageLimit", "isActive")
VALUES
  ('WELCOME10',
   'Giảm 10% đơn đầu tiên',
   'Giảm 10% tối đa 20.000đ cho đơn từ 50.000đ',
   'PERCENT', 10, 20000, 50000, 1000, TRUE)
ON CONFLICT ("code") DO NOTHING;

COMMIT;
