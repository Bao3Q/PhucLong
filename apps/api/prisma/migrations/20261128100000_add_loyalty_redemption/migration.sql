ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS
"voucherDiscountAmount"
INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS
"loyaltyDiscountAmount"
INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS
"loyaltyPointsRedeemed"
INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_discount_amounts_nonnegative"
CHECK (
  "discountAmount" >= 0
  AND "voucherDiscountAmount" >= 0
  AND "loyaltyDiscountAmount" >= 0
  AND "loyaltyPointsRedeemed" >= 0
);