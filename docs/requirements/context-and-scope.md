# Task 1.1 — Bối cảnh, Stakeholder và Phạm vi (Context & Scope)

Dự án: **BrewLite — nền tảng đặt đồ uống Phúc Long Coffee & Tea** (Assignment 2, Requirements to Deployment).

## 1. Bối cảnh và vấn đề nghiệp vụ

Tại cửa hàng Phúc Long, khách hiện phải **xếp hàng tại quầy** để gọi món, chờ nhân viên ghi order thủ công, thanh toán tiền mặt/thẻ tại quầy và không có cách nào theo dõi tiến độ pha chế của món mình. Điều này gây:

- thời gian chờ dài vào giờ cao điểm, khách bỏ đi vì chờ quá lâu;
- sai sót khi ghi order tay (nhầm size, nhầm topping);
- quản lý không có số liệu đơn hàng theo thời gian thực;
- không có dữ liệu đơn tập trung để đối soát với đơn vị thanh toán.

**BrewLite** giải quyết bằng luồng: *Xem menu → Chọn tùy chọn (size/topping) → Giỏ hàng → Đặt đơn → Thanh toán (Ví/Thẻ mô phỏng) → Theo dõi đơn*, chạy trên Next.js (mobile-first/PWA) + NestJS + PostgreSQL.

## 2. Stakeholder chính và mục tiêu

| Stakeholder | Vai trò trong hệ thống | Mục tiêu & kỳ vọng |
| --- | --- | --- |
| **Khách hàng** | Người đặt món, thanh toán, theo dõi đơn | Đặt món nhanh không xếp hàng; thấy rõ giá theo size/topping trước khi trả tiền; theo dõi trạng thái đơn; lịch sử đơn |
| **Nhân viên quầy** | Nhận đơn, pha chế, cập nhật trạng thái | Xem đơn mới theo thời gian thực, không chép order tay; biết đúng yêu cầu size/topping/ghi chú của khách |
| **Quản lý cửa hàng** | Quản trị menu, theo dõi tồn kho | Thêm/sửa món và giá; theo dõi nguyên liệu, số ly còn lại; không cho bán khi hết hàng |
| **Đơn vị thanh toán** | Xử lý giao dịch Ví/Thẻ | Nhận yêu cầu thanh toán chuẩn hóa, **không bị trừ tiền trùng lặp** (idempotency), đối soát được qua bản ghi payment |
| **Giảng viên / khách hàng nghiệm thu** | Chấm điểm, nghiệm thu sản phẩm | Truy vết được yêu cầu → thiết kế → code → test; chạy được hệ thống theo README; truy cập được bản production |
| **Nhóm phát triển** | Xây dựng và vận hành | Quy trình Git/CI rõ ràng; kiến trúc đơn giản dễ mở rộng; deploy/rollback an toàn |

## 3. Phạm vi MVP (in-scope)

Các chức năng bắt buộc để luồng end-to-end chạy được (mức **Must** trong SRS).

| # | Chức năng | Mã yêu cầu |
| --- | --- | --- |
| 1 | Xem menu theo danh mục và chi tiết món (`GET /products`, `GET /products/:id`), có trạng thái loading / empty / error | FR-01 |
| 2 | Chọn size S/M/L, topping, ghi chú, số lượng; giá tự cập nhật | FR-02 |
| 3 | Giỏ hàng lưu `localStorage`, sửa/xoá món, tính tổng tiền | FR-03 |
| 4 | Đăng ký / đăng nhập, xác thực JWT | FR-04 |
| 5 | Tạo đơn hàng (`POST /orders`, cần JWT), giá do server tính, giữ tồn kho, trạng thái khởi tạo `PENDING` | FR-05 |
| 6 | Thanh toán Ví/Thẻ **mô phỏng** với `Idempotency-Key`; thành công → `PAID` và trừ ly + nguyên liệu trong một transaction; thất bại → rollback, đơn giữ `PENDING` | FR-06 |
| 7 | Xác nhận đơn, trạng thái và lịch sử đơn (`/orders/[id]`, `/orders`) | FR-07 |
| 8 | Quản lý trạng thái đơn `PAID → PREPARING → READY → COMPLETED`, huỷ đơn hoàn kho | FR-09 |
| 9 | Health check `GET /health`; chạy toàn hệ thống bằng `docker-compose` | NFR-04 |

## 4. Phạm vi mở rộng (extended scope)

**Đã làm thêm ngoài MVP** (không bắt buộc theo đề, mức Should/Could):

| Chức năng | Mã yêu cầu | Ghi chú |
| --- | --- | --- |
| Mã khuyến mãi khi đặt đơn (`POST /promotions/validate`, `voucherCode`) | FR-08 | Áp dụng trên trang Checkout |
| Thanh toán chuyển khoản QR qua SePay (webhook xác thực bằng API key) | FR-10 | Luồng thay thế A2 của UC-01b |
| Cộng điểm thưởng khi thanh toán (1 điểm / 10.000đ, `LoyaltyTransaction` EARN) | FR-11 | Hiển thị số điểm trên trang đơn hàng |
| Tự huỷ đơn `PENDING` quá hạn (mặc định 10 phút) và hoàn tồn kho | FR-09 | `OrderExpiryService` |
| Quản trị sản phẩm cho ADMIN (`POST`/`PATCH /products`, RBAC), xem tồn kho nguyên liệu (`GET /inventory`) | NFR-02 | Chưa có giao diện quản trị, gọi qua API |

**Có thể làm ở phiên bản sau**: màn hình quầy cho nhân viên xem đơn mới và đổi trạng thái; đổi điểm thưởng (REDEEM); giao diện quản trị menu và khuyến mãi; thông báo khi đơn đổi trạng thái.

## 5. Ngoài phạm vi (out-of-scope)

- **Cổng Ví/Thẻ thật**: không tích hợp MoMo/VNPAY/thẻ ngân hàng thật; Ví/Thẻ chỉ là dịch vụ mô phỏng trong NestJS (ADR-003).
- **Giao hàng**: không có module ship, địa chỉ, phí vận chuyển.
- **Thông báo đẩy**: không có push notification / email / SMS khi đổi trạng thái đơn (khách tự xem trên trang đơn hàng).
- **Nhiều chi nhánh / multi-tenant**, phân quyền nhân viên chi tiết, báo cáo doanh thu.
- **POS phần cứng**: in hoá đơn nhiệt, máy quét mã.

## 6. Giả định (assumptions)

- Khách hàng có smartphone/máy tính với trình duyệt hiện đại và kết nối internet.
- Dịch vụ thanh toán mô phỏng chấp nhận mọi giao dịch hợp lệ và kết quả do hệ thống quyết định (không phụ thuộc bên thứ ba).
- Hệ thống phục vụ **một cửa hàng** duy nhất, menu quy mô nhỏ (< 100 món) — chưa cần cache Redis hay tìm kiếm full-text.
- Ảnh món dùng URL ngoài (Unsplash/CDN public), không tự lưu trữ file.
- Nhóm đủ 4–6 thành viên, phân vai theo task của đề bài.

## 7. Ràng buộc (constraints)

| Loại | Ràng buộc |
| --- | --- |
| Công nghệ | Bắt buộc **Next.js + NestJS + PostgreSQL** (đề bài không cho thay thế ba thành phần này) |
| Hiệu năng | API menu/sản phẩm phản hồi < 500ms với 95% request (NFR-01) |
| Bảo mật | API tạo đơn/thanh toán bảo vệ bằng JWT (NFR-02); role CUSTOMER/ADMIN |
| Giao diện | Mobile-first, chuẩn từ màn hình 360px trở lên (NFR-03) |
| Triển khai | Đóng gói Docker; `docker-compose up` chạy được toàn hệ thống (NFR-04) |
| Nền tảng | Dùng tier miễn phí: Vercel (web), Render (API/Docker), Neon (PostgreSQL) |
| Thời gian | Hoàn thành theo 5 task tuần tự trong học kỳ, Sprint 1 + Sprint 2 |

## 8. Rủi ro ban đầu và hướng xử lý

| Rủi ro | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Render free tier **ngủ sau ~15 phút idle** → request đầu chậm 30s+ | Demo chậm khi giảng viên truy cập | Health check định kỳ; nêu rõ trong README; demo chuẩn bị trước bằng 1 request đánh thức |
| Giới hạn free tier của Neon/Vercel/Render (storage, bandwidth) | Hệ thống dừng nếu vượt hạn mức | Theo dõi dashboard; dữ liệu demo nhỏ; backup định kỳ |
| Mock payment khác xa cổng thật | Luồng thật (3DS, callback) không được kiểm chứng | Giữ interface `PaymentsService` dễ thay bằng adapter cổng thật sau này; ghi rõ trong tài liệu |
| Ảnh menu dùng URL ngoài có thể chết | Menu hiển thị thiếu ảnh | Dùng nguồn ổn định (Unsplash CDN); nếu cần, chuyển sang lưu ảnh nội bộ |
| Scope creep (loyalty, promotion, ship) | Trễ deadline các task bắt buộc | Khoá phạm vi theo mục 3–5; phần mở rộng chỉ làm khi 5 task đã xong |
| `PATCH /orders/:id/status` cho phép cả chủ đơn đổi trạng thái | Khách có thể tự chuyển đơn của mình sang `PAID` mà không thanh toán | Giới hạn API đổi trạng thái chỉ cho ADMIN (khách chỉ được huỷ đơn `PENDING`); bổ sung test phân quyền |
| Chưa có màn hình cho nhân viên quầy | Nhân viên phải gọi API để đổi trạng thái đơn | Ưu tiên làm màn hình quầy ở phiên bản sau (mục 4) |
