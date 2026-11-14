-- Idempotency thanh toán mock (momo/card) phải là ràng buộc DB chứ không chỉ
-- là câu SELECT trước khi ghi: hai request cùng key chạm đồng thời phải có
-- đúng một bên ghi thành công.
--
-- Dọn bản ghi trùng (giữ bản mới nhất) trước khi tạo unique index. Postgres
-- mặc định coi NULL là khác nhau nên các payment SePay (không có key) không bị ảnh hưởng.
DELETE FROM "Payment" a USING "Payment" b
WHERE a."id" < b."id"
  AND a."userId" = b."userId"
  AND a."idempotencyKey" IS NOT NULL
  AND a."idempotencyKey" = b."idempotencyKey";

CREATE UNIQUE INDEX "Payment_userId_idempotencyKey_key"
ON "Payment"("userId", "idempotencyKey");
