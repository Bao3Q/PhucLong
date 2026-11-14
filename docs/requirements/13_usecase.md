# Đặc tả Usecase

**Đặt đơn hàng – Thanh toán đơn hàng** (use-case trọng tâm UC-01, theo khuyến nghị Task 1.3 của đề bài)

## Đặt đơn hàng

| | |
| :---: | :--- |
| **Tóm tắt** | Usecase được sử dụng khi khách hàng muốn đặt các món đã chọn trong giỏ hàng thành một đơn hàng |
| **Actor** | Khách hàng (đã đăng nhập) |
| **Dòng sự kiện chính** | 1. Khách hàng xem menu và chọn món kèm size, topping, ghi chú, số lượng vào giỏ hàng<br>2. Khách hàng mở trang Checkout và kiểm tra lại giỏ hàng<br>3. Khách hàng chọn "Đặt đơn"<br>4. Hệ thống nhận yêu cầu `POST /orders` kèm JWT, tạo đơn hàng ở trạng thái PENDING cùng các OrderItem (size, topping, ghi chú, số lượng, giá)<br>5. Hệ thống trả về mã đơn hàng cho khách hàng |
| **Dòng sự kiện phụ** | 2.1 Giỏ hàng trống, hệ thống yêu cầu quay lại menu chọn món<br>3.1 Khách hàng chưa đăng nhập hoặc JWT hết hạn, hệ thống trả về 401 và chuyển tới trang Đăng nhập<br>4.1 Mất kết nối máy chủ, hệ thống hiển thị lỗi và cho thử lại (giỏ hàng không bị mất) |
| **Tiền điều kiện** | Khách hàng đã đăng nhập (có JWT hợp lệ); giỏ hàng có ít nhất một món |
| **Hậu điều kiện** | Đơn hàng được lưu vào PostgreSQL ở trạng thái PENDING kèm danh sách OrderItem |

## Thanh toán đơn hàng

| | |
| :---: | :--- |
| **Tóm tắt** | Usecase được sử dụng khi khách hàng muốn thanh toán đơn hàng bằng Ví MoMo hoặc Thẻ (dịch vụ mô phỏng) |
| **Actor** | Khách hàng; Dịch vụ thanh toán (mô phỏng) |
| **Dòng sự kiện chính** | 1. Khách hàng chọn phương thức thanh toán (MoMo hoặc Thẻ)<br>2. Khách hàng chọn "Thanh toán"<br>3. Hệ thống nhận yêu cầu `POST /payments` kèm idempotency-key<br>4. Hệ thống trừ tồn kho nguyên liệu (theo công thức) và ly (theo size), cập nhật đơn thành PAID và ghi nhận thanh toán trong cùng một transaction<br>5. Hệ thống hiển thị trang xác nhận với mã đơn hàng và trạng thái |
| **Dòng sự kiện phụ** | 1.1 Dịch vụ thanh toán từ chối giao dịch (thẻ hết tiền, hết ly, hết nguyên liệu), đơn chuyển PAYMENT_FAILED, không trừ kho, khách hàng thử lại<br>3.1 Client gửi lại yêu cầu với cùng idempotency-key, hệ thống trả về kết quả của lần đầu, không trừ tiền trùng lặp<br>4.1 Đơn hàng đã ở trạng thái PAID, hệ thống từ chối thanh toán lần hai<br>5.1 Database ngừng hoạt động, hệ thống trả về 503 và thông báo khách hàng thử lại sau |
| **Tiền điều kiện** | Đơn hàng tồn tại ở trạng thái PENDING (chưa thanh toán); API và database hoạt động bình thường |
| **Hậu điều kiện** | Đơn hàng chuyển PAID, tồn kho đã trừ đúng lượng, bản ghi Payment được lưu; nếu thất bại đơn giữ PAYMENT_FAILED và không có giao dịch trùng lặp |

---

## Liên kết yêu cầu và tiêu chí chấp nhận

| Use-case | Mã yêu cầu liên quan | Tiêu chí chấp nhận (đầu vào viết test) |
| --- | --- | --- |
| Đặt đơn hàng | FR-02, FR-03, FR-05 · NFR-02 | AC-01: `POST /orders` không JWT → 401 (`jwt-auth.guard.spec.ts`) · AC-06: đơn không tồn tại → 404 (`orders.service.spec.ts`) |
| Thanh toán đơn hàng | FR-06, FR-07 · NFR-01 | AC-02: retry cùng idempotency-key không trừ trùng (`payments.service.spec.ts`) · AC-03: thành công → PAID + trừ kho (`payments.service.spec.ts`) · AC-04: thất bại → không trừ kho (`payments.service.spec.ts`) · AC-07: DB down → 503 (`health.controller.spec.ts`) |

Sơ đồ liên quan: `docs/diagrams/Task1_3_UseCase.svg` (use-case phạm vi UC-01 — Task 1.3) · `docs/diagrams/Task1_2_UseCase.svg` (use-case tổng quát hệ thống — Task 1.2) · `docs/diagrams/Task2_2_Sequence.svg` (sequence UC-01) · `docs/diagrams/Task2_1_Activity.svg` (activity end-to-end).
