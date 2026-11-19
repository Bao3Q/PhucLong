# Task 1.2 — Yêu cầu chức năng và phi chức năng (SRS rút gọn)

Mức ưu tiên theo **MoSCoW**: Must (bắt buộc cho MVP) · Should (nên có) · Could (có thì tốt) · Won't (không làm trong phiên bản này).

## 1. Yêu cầu chức năng (Functional Requirements - FR)

| Mã FR | Nhóm | Tên yêu cầu | Mô tả chi tiết | Ưu tiên | Tiêu chí chấp nhận (kiểm chứng được) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | Menu | Xem menu | Hiển thị danh sách đồ uống theo danh mục kèm ảnh và giá. | Must | `GET /products` trả 200 và danh sách món; lọc theo `category` trả đúng danh mục; trang menu có trạng thái loading, empty (không có món) và error (API lỗi, có nút thử lại). |
| **FR-02** | Chi tiết sản phẩm | Xem chi tiết và chọn tuỳ chọn | Xem chi tiết món, chọn size S/M/L, topping, ghi chú, số lượng. | Must | `GET /products/:id` trả 200, id không tồn tại trả 404; giá hiển thị = giá gốc + phụ phí size + tổng topping, đổi lựa chọn thì giá cập nhật ngay. |
| **FR-03** | Giỏ hàng | Quản lý giỏ hàng | Thêm, sửa số lượng, xoá món và tính tổng tiền. | Must | Thêm cùng món + cùng tuỳ chọn thì gộp dòng và cộng số lượng; tổng tiền = tổng (đơn giá × số lượng); tải lại trang giỏ vẫn còn (`localStorage`); giỏ rỗng thì không bấm được đặt hàng. |
| **FR-04** | Xác thực | Đăng ký và đăng nhập | Khách tạo tài khoản bằng email/mật khẩu và đăng nhập nhận JWT. | Must | Đăng ký email đã tồn tại trả 409; đăng nhập đúng trả JWT (hết hạn sau 1 giờ), sai mật khẩu trả 401; mật khẩu lưu dạng băm, không lưu bản rõ. |
| **FR-05** | Đặt đơn | Tạo đơn hàng | Chuyển giỏ hàng thành đơn hàng ở trạng thái `PENDING`. | Must | `POST /orders` không JWT trả 401; dữ liệu sai trả 400; món không đủ tồn kho trả 400 (hai người tranh món cuối: một người nhận 409); thành công trả 201, đơn `PENDING` có OrderItem, giá do server tính, tồn kho bị trừ. |
| **FR-06** | Thanh toán | Thanh toán Ví/Thẻ mô phỏng | Thanh toán đơn `PENDING` bằng Ví MoMo hoặc Thẻ qua dịch vụ mô phỏng, có `Idempotency-Key`. | Must | Thành công: đơn chuyển `PAID`, trừ ly và nguyên liệu, ghi Payment, trong một transaction; gửi lại cùng `Idempotency-Key` trả đúng kết quả lần đầu và không trừ kho lần hai; thất bại (thiếu ly/nguyên liệu, lỗi DB): rollback, đơn giữ `PENDING`, không có Payment thành công; thanh toán đơn đã `PAID` trả 400. |
| **FR-07** | Lịch sử đơn | Xác nhận, trạng thái và lịch sử đơn | Khách xem trang xác nhận đơn, trạng thái hiện tại và danh sách đơn của mình. | Must | `GET /orders/:id` chỉ chủ đơn hoặc ADMIN xem được (người khác 403, không tồn tại 404); `GET /orders/me` chỉ trả đơn của chính người gọi; trang đơn hiển thị đúng nhãn trạng thái: Chờ thanh toán, Đã thanh toán, Đang pha chế, Sẵn sàng – mời nhận, Hoàn tất, Đã huỷ (nhãn trong `apps/web/lib/orders.ts`). |
| **FR-08** | Đặt đơn | Áp dụng khuyến mãi | Nhập mã giảm giá trước khi đặt đơn. | Could | Mã hợp lệ: giảm đúng theo phần trăm (có trần) hoặc số tiền cố định, tổng tiền cập nhật trước khi thanh toán; mã không tồn tại, hết hạn, hết lượt hoặc chưa đạt đơn tối thiểu trả 400 kèm lý do. |
| **FR-09** | Quản lý trạng thái đơn | Cập nhật trạng thái đơn | Nhân viên quầy/ADMIN chuyển trạng thái theo máy trạng thái `PENDING → PAID → PREPARING → READY → COMPLETED`; đơn `PENDING`/`PAID` có thể huỷ (`CANCELLED`) và hoàn tồn kho; đơn `PENDING` quá hạn tự huỷ. | Must | `PATCH /orders/:id/status` chuyển sai bước (VD `PAID → PENDING`, `COMPLETED →` bất kỳ) trả 400; không có JWT trả 401, tài khoản không phải ADMIN (kể cả chủ đơn) trả 403; huỷ đơn hoàn lại tồn kho đúng một lần; đơn `PENDING` quá 10 phút tự chuyển `CANCELLED`; khách thấy trạng thái mới ở `/orders/[id]`. |
| **FR-10** | Thanh toán | Thanh toán chuyển khoản QR (SePay) | Tạo mã QR có hạn 2 phút; đơn chuyển `PAID` khi SePay gửi webhook xác nhận nhận tiền. | Should | `POST /payments/sepay` trả mã thanh toán và QR; webhook sai API key trả 401; webhook đúng mã, đủ tiền, còn hạn → đơn `PAID`; quá hạn hoặc thiếu tiền → Payment `EXPIRED`/`FAILED`, đơn giữ `PENDING`; webhook gửi trùng không xử lý lần hai. |
| **FR-11** | Thanh toán | Điểm thưởng | Cộng điểm khi thanh toán thành công. | Could | Thanh toán thành công cộng `floor(total / 10.000)` điểm, ghi một `LoyaltyTransaction` loại EARN; thanh toán thất bại không cộng điểm. |
| **FR-12** | Thanh toán | Cổng Ví/Thẻ thật | Tích hợp MoMo/VNPAY/thẻ ngân hàng thật. | Won't | Không làm trong v1.0 (xem context-and-scope mục 5). |
| **FR-13** | Thông báo | Thông báo đẩy | Gửi push/email/SMS khi đơn đổi trạng thái. | Won't | Không làm trong v1.0; khách tự xem trạng thái trên trang đơn. |

### User story (dùng trong ma trận truy vết)

| Mã | User story | FR |
| --- | --- | --- |
| US-01 | Là khách hàng, tôi muốn xem menu theo danh mục để chọn đồ uống. | FR-01 |
| US-02 | Là khách hàng, tôi muốn chọn size, topping và ghi chú để món đúng ý. | FR-02 |
| US-03 | Là khách hàng, tôi muốn quản lý giỏ hàng và thấy tổng tiền trước khi đặt. | FR-03 |
| US-04 | Là khách hàng, tôi muốn đăng ký và đăng nhập để đặt đơn và xem lịch sử. | FR-04 |
| US-05 | Là khách hàng, tôi muốn theo dõi trạng thái và lịch sử đơn của mình. | FR-07 |
| US-06 | Là khách hàng, tôi muốn nhập mã giảm giá để được giảm tiền. | FR-08 |
| US-07 | Là nhân viên quầy, tôi muốn cập nhật trạng thái đơn để khách biết tiến độ pha chế. | FR-09 |
| US-08 | Là khách hàng, tôi muốn thanh toán bằng chuyển khoản QR. | FR-10 |
| US-09 | Là khách hàng, tôi muốn được cộng điểm khi mua hàng. | FR-11 |

Đặt và thanh toán đơn hàng (FR-05, FR-06) được đặc tả đầy đủ dưới dạng use-case **UC-01** trong [`13_usecase.md`](13_usecase.md).

---

## 2. Yêu cầu phi chức năng (Non-Functional Requirements - NFR)

| Mã NFR | Nhóm yêu cầu | Nội dung yêu cầu | Mức ưu tiên | Tiêu chí chấp nhận |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-01** | Hiệu năng | Thời gian phản hồi API menu và sản phẩm. | Should | Phản hồi dưới 500ms với 95% số request. |
| **NFR-02** | Bảo mật | Bảo vệ các API tạo đơn, thanh toán bằng JWT. | Must | Không có JWT hợp lệ trả về HTTP 401 Unauthorized. |
| **NFR-03** | Khả năng sử dụng (mobile-first/PWA) | Thiết kế giao diện Mobile-first/PWA. | Must | Bố cục hiển thị chuẩn trên màn hình từ 360px trở lên; có web app manifest (`/manifest.webmanifest`) và icon để cài lên màn hình chính. |
| **NFR-04** | Khả năng triển khai | Đóng gói và chạy qua Docker container. | Must | Lệnh `docker-compose up` khởi chạy thành công; `GET /health` trả về HTTP 200. |
| **NFR-05** | Tính khả dụng (availability) | Hệ thống production truy cập được qua HTTPS; tự phát hiện lỗi sau triển khai và quay về bản ổn định. | Must | `GET /health` trả 200 và `database: up` sau mỗi lần deploy (smoke test trong CD); deploy lỗi thì pipeline dừng và rollback; database production không mở public. |
| **NFR-06** | Bảo mật cấu hình & nhật ký | Secret chỉ nằm trong biến môi trường của nền tảng/CI; ghi log khởi động và lỗi để chẩn đoán sự cố. | Must | Không có secret thật trong repository hoặc log CI (`.env` bị `.gitignore`, secret dùng `secrets.*` của GitHub Actions); log API xem được trên Render. |

---

## 3. Sơ đồ use-case tổng quát

![Use-case tổng quát](../diagrams/Task1_2_UseCase.svg)

Nguồn: [`docs/diagrams/Task1_2_UseCase.puml`](../diagrams/Task1_2_UseCase.puml) · ảnh: `Task1_2_UseCase.svg`, `Task1_2_UseCase.png`.

| Actor | Use-case chính |
| --- | --- |
| Khách hàng | UC01 Xem menu · UC02 Chi tiết món · UC03 Giỏ hàng · UC04 Đăng ký · UC05 Đăng nhập · UC06 Đặt đơn · UC09 Xác nhận & trạng thái · UC10 Lịch sử đơn |
| Quản trị viên / Nhân viên quầy (ADMIN) | UC11 Cập nhật trạng thái đơn · UC12 Quản lý sản phẩm · UC13 Xem tồn kho |
| Dịch vụ thanh toán (mô phỏng / SePay) | UC07 Thanh toán đơn |
| Bộ hẹn giờ hệ thống | UC14 Hủy đơn PENDING quá hạn |

Use-case trọng tâm được đặc tả chi tiết: **UC-01 Đặt và thanh toán đơn hàng** (gồm UC06 + UC07) — xem [`13_usecase.md`](13_usecase.md).
