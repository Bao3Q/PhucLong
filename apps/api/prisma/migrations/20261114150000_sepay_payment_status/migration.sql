-- Thêm phiên thanh toán có thời hạn cho luồng SePay (chuyển khoản QR)
ALTER TABLE "Payment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Payment" ADD COLUMN "paymentCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_paymentCode_key" ON "Payment"("paymentCode");

-- Các thanh toán cũ (momo/card) hoàn tất ngay khi tạo → đánh dấu PAID
UPDATE "Payment" SET "status" = 'PAID', "paidAt" = "createdAt" WHERE "success" = true;
