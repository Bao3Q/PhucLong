BEGIN;

CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";

-- =============================================================================
-- 1. ENUM
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'OrderStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "OrderStatus" AS ENUM (
      'PENDING',
      'PAID',
      'PAYMENT_FAILED',
      'PREPARING',
      'READY',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ProductSize' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "ProductSize" AS ENUM ('S', 'M', 'L');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'UserRole' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PaymentMethod' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD', 'CASH');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PaymentStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "PaymentStatus" AS ENUM (
      'PENDING',
      'SUCCESS',
      'FAILED',
      'REFUNDED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DiscountType' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LoyaltyTransactionType' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "LoyaltyTransactionType" AS ENUM (
      'EARN',
      'REDEEM',
      'ADJUST',
      'EXPIRE'
    );
  END IF;
END
$$;

-- =============================================================================
-- 2. BẢNG
-- =============================================================================

-- -----------------------------------------------------------------------------
-- User
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "User" (
    "id"            TEXT         NOT NULL,
    "email"         TEXT         NOT NULL,
    "passwordHash"  TEXT         NOT NULL,
    "role"          "UserRole"   NOT NULL DEFAULT 'CUSTOMER',
    "loyaltyPoints" INTEGER      NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_loyaltyPoints_check" CHECK ("loyaltyPoints" >= 0),
    CONSTRAINT "User_email_not_empty_check" CHECK (length(trim("email")) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"
    ON "User" ("email");

-- -----------------------------------------------------------------------------
-- Promotion
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Promotion" (
    "id"                SERIAL       NOT NULL,
    "code"              TEXT         NOT NULL,
    "name"              TEXT         NOT NULL,
    "description"       TEXT,
    "discountType"      "DiscountType" NOT NULL,
    "discountValue"     INTEGER      NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minOrderAmount"    INTEGER      NOT NULL DEFAULT 0,
    "usageLimit"        INTEGER,
    "usedCount"         INTEGER      NOT NULL DEFAULT 0,
    "isActive"          BOOLEAN      NOT NULL DEFAULT TRUE,
    "startsAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt"            TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Promotion_discountValue_check" CHECK ("discountValue" > 0),
    CONSTRAINT "Promotion_percent_check"
        CHECK ("discountType" <> 'PERCENT' OR "discountValue" <= 100),
    CONSTRAINT "Promotion_amounts_check"
        CHECK (
            "minOrderAmount" >= 0
            AND ("maxDiscountAmount" IS NULL OR "maxDiscountAmount" > 0)
        ),
    CONSTRAINT "Promotion_usage_check"
        CHECK (
            "usageLimit" IS NULL
            OR (
                "usageLimit" >= 0
                AND "usedCount" >= 0
                AND "usedCount" <= "usageLimit"
            )
        ),
    CONSTRAINT "Promotion_dates_check"
        CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key"
    ON "Promotion" ("code");

CREATE INDEX IF NOT EXISTS "Promotion_active_dates_idx"
    ON "Promotion" ("isActive", "startsAt", "endsAt");

-- -----------------------------------------------------------------------------
-- Product
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Product" (
    "id"       TEXT    NOT NULL,
    "name"     TEXT    NOT NULL,
    "price"    INTEGER NOT NULL,
    "imageUrl" TEXT    NOT NULL,
    "stock"    INTEGER NOT NULL DEFAULT 0,
    "version"  INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_price_check" CHECK ("price" >= 0),
    CONSTRAINT "Product_stock_check" CHECK ("stock" >= 0),
    CONSTRAINT "Product_version_check" CHECK ("version" >= 0)
);

CREATE INDEX IF NOT EXISTS "Product_name_idx"
    ON "Product" ("name");

-- -----------------------------------------------------------------------------
-- Order
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Order" (
    "id"             SERIAL         NOT NULL,
    "userId"         TEXT           NOT NULL,
    "status"         "OrderStatus"  NOT NULL DEFAULT 'PENDING',
    "subtotal"       INTEGER        NOT NULL DEFAULT 0,
    "discountAmount" INTEGER        NOT NULL DEFAULT 0,
    "voucherCode"    TEXT,
    "total"          INTEGER        NOT NULL,
    "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Order_subtotal_check" CHECK ("subtotal" >= 0),
    CONSTRAINT "Order_discountAmount_check" CHECK ("discountAmount" >= 0),
    CONSTRAINT "Order_total_check" CHECK ("total" >= 0),
    CONSTRAINT "Order_discount_not_exceed_subtotal_check"
        CHECK ("discountAmount" <= "subtotal"),
    CONSTRAINT "Order_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_voucherCode_fkey"
        FOREIGN KEY ("voucherCode") REFERENCES "Promotion" ("code")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx"
    ON "Order" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_status_idx"
    ON "Order" ("status");

CREATE INDEX IF NOT EXISTS "Order_voucherCode_idx"
    ON "Order" ("voucherCode");

-- -----------------------------------------------------------------------------
-- OrderItem
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id"          SERIAL        NOT NULL,
    "orderId"     INTEGER       NOT NULL,
    "productId"   TEXT          NOT NULL,
    "productName" TEXT          NOT NULL,
    "size"        "ProductSize" NOT NULL,
    "toppings"    TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],
    "qty"         INTEGER       NOT NULL,
    "unitPrice"   INTEGER       NOT NULL,
    "lineTotal"   INTEGER       NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderItem_qty_check" CHECK ("qty" > 0),
    CONSTRAINT "OrderItem_unitPrice_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "OrderItem_lineTotal_check" CHECK ("lineTotal" >= 0),
    CONSTRAINT "OrderItem_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
    ON "OrderItem" ("orderId");

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx"
    ON "OrderItem" ("productId");

-- -----------------------------------------------------------------------------
-- Payment
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Payment" (
    "id"             SERIAL          NOT NULL,
    "orderId"        INTEGER         NOT NULL,
    "amount"         INTEGER         NOT NULL DEFAULT 0,
    "method"         "PaymentMethod" NOT NULL DEFAULT 'WALLET',
    "status"         "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider"       TEXT            NOT NULL DEFAULT 'MOCK',
    "transactionRef" TEXT,
    "idempotencyKey" TEXT            NOT NULL,
    "failureReason"  TEXT,
    "paidAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "Payment_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key"
    ON "Payment" ("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_transactionRef_key"
    ON "Payment" ("transactionRef")
    WHERE "transactionRef" IS NOT NULL;

-- Mỗi đơn hàng chỉ được có tối đa 1 giao dịch thành công.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_success_key"
    ON "Payment" ("orderId")
    WHERE "status" = 'SUCCESS';

CREATE INDEX IF NOT EXISTS "Payment_orderId_createdAt_idx"
    ON "Payment" ("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_status_idx"
    ON "Payment" ("status");

-- -----------------------------------------------------------------------------
-- LoyaltyTransaction
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
    "id"           SERIAL                   NOT NULL,
    "userId"       TEXT                     NOT NULL,
    "orderId"      INTEGER,
    "type"         "LoyaltyTransactionType" NOT NULL,
    "points"       INTEGER                  NOT NULL,
    "balanceAfter" INTEGER                  NOT NULL,
    "description"  TEXT,
    "createdAt"    TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyTransaction_points_check" CHECK ("points" <> 0),
    CONSTRAINT "LoyaltyTransaction_balanceAfter_check"
        CHECK ("balanceAfter" >= 0),
    CONSTRAINT "LoyaltyTransaction_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoyaltyTransaction_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_createdAt_idx"
    ON "LoyaltyTransaction" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_orderId_idx"
    ON "LoyaltyTransaction" ("orderId");

-- Chặn cộng điểm trùng cho cùng một đơn hàng.
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_orderId_earn_key"
    ON "LoyaltyTransaction" ("orderId")
    WHERE "type" = 'EARN' AND "orderId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id"        SERIAL        NOT NULL,
    "name"      TEXT          NOT NULL,
    "quantity"  NUMERIC(10,2) NOT NULL DEFAULT 0,
    "unit"      TEXT          NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Ingredient_quantity_check" CHECK ("quantity" >= 0)
);

COMMENT ON TABLE "Ingredient" IS
    'Danh sách nguyên liệu và số lượng tồn kho.';
COMMENT ON COLUMN "Ingredient"."quantity" IS
    'Số lượng nguyên liệu hiện có, tính theo unit.';

CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Order_set_updated_at" ON "Order";
CREATE TRIGGER "Order_set_updated_at"
    BEFORE UPDATE ON "Order"
    FOR EACH ROW
    EXECUTE FUNCTION "set_updated_at"();

DROP TRIGGER IF EXISTS "Payment_set_updated_at" ON "Payment";
CREATE TRIGGER "Payment_set_updated_at"
    BEFORE UPDATE ON "Payment"
    FOR EACH ROW
    EXECUTE FUNCTION "set_updated_at"();

DROP TRIGGER IF EXISTS "Promotion_set_updated_at" ON "Promotion";
CREATE TRIGGER "Promotion_set_updated_at"
    BEFORE UPDATE ON "Promotion"
    FOR EACH ROW
    EXECUTE FUNCTION "set_updated_at"();

DROP TRIGGER IF EXISTS "Ingredient_set_updated_at" ON "Ingredient";
CREATE TRIGGER "Ingredient_set_updated_at"
    BEFORE UPDATE ON "Ingredient"
    FOR EACH ROW
    EXECUTE FUNCTION "set_updated_at"();

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "amount" INTEGER NOT NULL DEFAULT 0;

-- Tài khoản ADMIN mặc định để đăng nhập / thử API (Thunder Client, Postman...).
-- Email    : admin@maycha.vn
-- Mật khẩu : Admin@123456   (hash bcrypt bên dưới, cost 10)

INSERT INTO "User" ("id", "email", "passwordHash", "role", "loyaltyPoints", "createdAt")
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin@maycha.vn',
  '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56',
  'ADMIN',
  0,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET "role" = 'ADMIN',
    "passwordHash" = EXCLUDED."passwordHash";

COMMIT;
