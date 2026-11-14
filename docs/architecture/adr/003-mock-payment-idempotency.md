# ADR-003: Dịch vụ thanh toán mô phỏng trong API, xử lý theo idempotency-key

- **Trạng thái**: Accepted
- **Ngày**: 2026-11-14

## Bối cảnh

MVP không tích hợp cổng thanh toán thật (MoMo/VCB) nhưng đề bài yêu cầu luồng thanh toán Ví/Thẻ có idempotency: client retry không được trừ tiền hai lần. Thanh toán thành công còn phải trừ tồn kho nguyên liệu (theo công thức) và ly (theo size).

## Quyết định

- Thanh toán mô phỏng là **module `payments` bên trong API** (không tách service riêng): `POST /payments` nhận `method` (`momo` | `card`) và `idempotency-key` (header hoặc body).
- Toàn bộ bước sau khi thanh toán thành công gói trong **một Prisma transaction**: trừ Ingredient + trừ Cup theo size → cập nhật Order `PAID` → ghi bản ghi Payment. Lỗi ở bất kỳ bước nào → rollback toàn bộ, đơn giữ trạng thái thất bại.
- Key idempotency đã xử lý → trả về kết quả của lần đầu; đơn đã PAID → từ chối thanh toán lần hai.

## Hệ quả

- ✅ Đúng đề bài: AC-02/AC-03/AC-04 của UC-01 có test tự động (`payments.service.spec.ts`).
- ✅ Giao diện `PaymentsService.processPayment` giữ mỏng — thay mock bằng adapter cổng thật (MoMo/VNPAY) chỉ cần thêm implementation mới, không đổi hợp đồng API.
- ⚠️ Kết quả "thành công/thất bại" do hệ thống tự quyết định — không phản ánh hành vi 3DS/callback của cổng thật (nêu trong rủi ro, context-and-scope.md mục 7).
- ⚠️ Không có hàng đợi/bất đồng bộ — hợp lệ cho quy mô một cửa hàng; tách service riêng khi cần scale.
