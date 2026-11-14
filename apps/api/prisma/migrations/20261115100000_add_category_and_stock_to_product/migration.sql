-- Thêm cột category cho Product (frontend lọc menu theo danh mục) và
-- đặt tồn kho ban đầu cho 4 sản phẩm seed — trước đây stock mặc định 0,
-- tạo đơn sẽ luôn báo hết hàng.
ALTER TABLE "Product" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Khác';

UPDATE "Product" SET "category" = 'Cà Phê'
WHERE "id" IN ('1', '2', '3', '4');

UPDATE "Product" SET "stock" = 50 WHERE "id" = '1';
UPDATE "Product" SET "stock" = 40 WHERE "id" = '2';
UPDATE "Product" SET "stock" = 30 WHERE "id" = '3';
UPDATE "Product" SET "stock" = 25 WHERE "id" = '4';
