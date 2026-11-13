-- Thêm Promotion, LoyaltyTransaction, Ingredient và các cột bổ sung
-- (Product.description/tag, OrderItem.note) cho database maycha_db.
-- Viết idempotent để chạy lại an toàn.

SET client_encoding TO 'UTF8';

-- =============================================================================
-- 1. ENUM bổ sung
-- =============================================================================

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
    CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');
  END IF;
END
$$;

-- =============================================================================
-- 2. Cột bổ sung cho bảng sẵn có
-- =============================================================================

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tag" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- =============================================================================
-- 3. Bảng Promotion
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Promotion" (
    "id"                SERIAL         NOT NULL,
    "code"              TEXT           NOT NULL,
    "name"              TEXT           NOT NULL,
    "description"       TEXT,
    "discountType"      "DiscountType" NOT NULL,
    "discountValue"     INTEGER        NOT NULL,
    "maxDiscountAmount" INTEGER,
    "minOrderAmount"    INTEGER        NOT NULL DEFAULT 0,
    "usageLimit"        INTEGER,
    "usedCount"         INTEGER        NOT NULL DEFAULT 0,
    "isActive"          BOOLEAN        NOT NULL DEFAULT TRUE,
    "startsAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt"            TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- FK Order.voucherCode -> Promotion.code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_voucherCode_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherCode_fkey"
      FOREIGN KEY ("voucherCode") REFERENCES "Promotion" ("code")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- =============================================================================
-- 4. Bảng LoyaltyTransaction
-- =============================================================================

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
    CONSTRAINT "LoyaltyTransaction_balanceAfter_check" CHECK ("balanceAfter" >= 0),
    CONSTRAINT "LoyaltyTransaction_type_points_check"
        CHECK (
            ("type" = 'EARN' AND "points" > 0)
            OR ("type" IN ('REDEEM', 'EXPIRE') AND "points" < 0)
            OR ("type" = 'ADJUST')
        ),
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

-- Chặn cộng điểm trùng cho cùng một đơn hàng
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_orderId_earn_key"
    ON "LoyaltyTransaction" ("orderId")
    WHERE "type" = 'EARN' AND "orderId" IS NOT NULL;

-- =============================================================================
-- 5. Bảng Ingredient (nguyên liệu: đường, sữa, cà phê)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Ingredient" (
    "id"        SERIAL        NOT NULL,
    "name"      TEXT          NOT NULL,
    "quantity"  NUMERIC(10,2) NOT NULL DEFAULT 0,
    "unit"      TEXT          NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Ingredient_name_key" UNIQUE ("name"),
    CONSTRAINT "Ingredient_quantity_check" CHECK ("quantity" >= 0)
);

COMMENT ON TABLE "Ingredient" IS
    'Danh sách nguyên liệu và số lượng tồn kho.';
COMMENT ON COLUMN "Ingredient"."quantity" IS
    'Số lượng nguyên liệu hiện có, tính theo unit.';

-- =============================================================================
-- 6. Trigger updatedAt
-- =============================================================================

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
