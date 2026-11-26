BEGIN;

-- Preserve the successful history of older records before status becomes authoritative.
UPDATE "Payment"
SET "status" = 'PAID', "paidAt" = COALESCE("paidAt", "createdAt")
WHERE "success" = true AND "status" IN ('PENDING', 'EXPIRED', 'FAILED');

-- Dropping paymentCode also removes its unique index.
ALTER TABLE "Payment"
    DROP COLUMN "paymentCode",
    DROP COLUMN "requestFingerprint",
    DROP COLUMN "success";

COMMIT;
