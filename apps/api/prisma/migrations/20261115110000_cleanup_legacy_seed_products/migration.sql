-- Dọn 4 sản phẩm seed cũ (id dạng slug: tra-sua-phuc-long, tra-dao-tram-huong,
-- ca-phe-sua-da, cappuccino-espresso) còn sót trong DB được bootstrap bằng
-- prisma/schema.sql trước đây. Menu chuẩn hiện tại là 4 sản phẩm id '1'-'4'
-- (SEED_PRODUCTS trong products.data.ts, API upsert lại khi khởi động).
--
-- OrderItem.product có onDelete: Restrict nên phải xóa OrderItem trỏ vào sản
-- phẩm cũ trước (chỉ ảnh hưởng đơn test đặt từ menu cũ — order còn lại sẽ rỗng
-- items). RecipeItem.product tự cascade nên không cần xử lý.
DELETE FROM "OrderItem" WHERE "productId" NOT IN ('1', '2', '3', '4');

DELETE FROM "Product" WHERE id NOT IN ('1', '2', '3', '4');
