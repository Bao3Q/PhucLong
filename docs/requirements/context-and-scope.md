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

| # | Chức năng | Mã yêu cầu |
| --- | --- | --- |
| 1 | Xem menu và chi tiết món (GET /products, /products/:id) | FR-01 |
| 2 | Chọn size S/M/L, topping động, ghi chú, số lượng; giá tự cập nhật | FR-02 |
| 3 | Giỏ hàng lưu localStorage, sửa/xóa món, tính tổng tiền | FR-03 |
| 4 | Đăng ký / đăng nhập, xác thực JWT | FR-04 |
| 5 | Tạo đơn hàng (POST /orders, cần JWT), trạng thái khởi tạo PENDING | FR-05 |
| 6 | Thanh toán Ví/Thẻ **mô phỏng** với idempotency-key; PAID / PAYMENT_FAILED; trừ tồn kho nguyên liệu + ly trong transaction | FR-06 |
| 7 | Xem đơn: trạng thái, chi tiết item, tổng tiền (order-success) | FR-07 |
| 8 | Quản trị menu cho ADMIN (POST /products, phân quyền RBAC), xem tồn kho (/inventory) | NFR-02 mở rộng |
| 9 | Health check GET /health; chạy bằng docker-compose local | NFR-04 |

## 4. Ngoài phạm vi (out-of-scope)

- **Thanh toán thật**: không tích hợp cổng MoMo/VCB/VNPAY thật — chỉ service mô phỏng trong NestJS.
- **Giao hàng / takeaway distance fee**: không có module ship, địa chỉ, phí vận chuyển.
- **Thông báo đẩy**: không có push notification / email / SMS khi đổi trạng thái đơn (khách tự xem).
- **Chương trình loyalty đầy đủ**: schema có `LoyaltyTransaction` nhưng MVP chưa có UI tích/điểm đổi điểm.
- **Khuyến mãi phức tạp**: chỉ giữ được mã voucher trên đơn (FR-08 mức Could), chưa có luồng áp dụng hoàn chỉnh trên UI.
- **Nhiều chi nhánh / multi-tenant**, phân quyền nhân viên chi tiết, báo cáo doanh thu dashboard.
- **POS phần cứng**: in hóa đơn nhiệt, máy quét mã.

## 5. Giả định (assumptions)

- Khách hàng có smartphone/máy tính với trình duyệt hiện đại và kết nối internet.
- Dịch vụ thanh toán mô phỏng chấp nhận mọi giao dịch hợp lệ và kết quả do hệ thống quyết định (không phụ thuộc bên thứ ba).
- Hệ thống phục vụ **một cửa hàng** duy nhất, menu quy mô nhỏ (< 100 món) — chưa cần cache Redis hay tìm kiếm full-text.
- Ảnh món dùng URL ngoài (Unsplash/CDN public), không tự lưu trữ file.
- Nhóm đủ 4–6 thành viên, phân vai theo task của đề bài.

## 6. Ràng buộc (constraints)

| Loại | Ràng buộc |
| --- | --- |
| Công nghệ | Bắt buộc **Next.js + NestJS + PostgreSQL** (đề bài không cho thay thế ba thành phần này) |
| Hiệu năng | API menu/sản phẩm phản hồi < 500ms với 95% request (NFR-01) |
| Bảo mật | API tạo đơn/thanh toán bảo vệ bằng JWT (NFR-02); role CUSTOMER/ADMIN |
| Giao diện | Mobile-first, chuẩn từ màn hình 360px trở lên (NFR-03) |
| Triển khai | Đóng gói Docker; `docker-compose up` chạy được toàn hệ thống (NFR-04) |
| Nền tảng | Dùng tier miễn phí: Vercel (web), Render (API/Docker), Neon (PostgreSQL) |
| Thời gian | Hoàn thành theo 5 task tuần tự trong học kỳ, Sprint 1 + Sprint 2 |

## 7. Rủi ro ban đầu và hướng xử lý

| Rủi ro | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |
| Render free tier **ngủ sau ~15 phút idle** → request đầu chậm 30s+ | Demo chậm khi giảng viên truy cập | Health check định kỳ; nêu rõ trong README; demo chuẩn bị trước bằng 1 request đánh thức |
| Giới hạn free tier của Neon/Vercel/Render (storage, bandwidth) | Hệ thống dừng nếu vượt hạn mức | Theo dõi dashboard; dữ liệu demo nhỏ; backup định kỳ |
| Mock payment khác xa cổng thật | Luồng thật (3DS, callback) không được kiểm chứng | Giữ interface `PaymentsService` dễ thay bằng adapter cổng thật sau này; ghi rõ trong tài liệu |
| Ảnh menu dùng URL ngoài có thể chết | Menu hiển thị thiếu ảnh | Dùng nguồn ổn định (Unsplash CDN); nếu cần, chuyển sang lưu ảnh nội bộ |
| Scope creep (loyalty, promotion, ship) | Trễ deadline các task bắt buộc | Khóa phạm vi theo mục 3–4; phần ngoài scope chỉ làm khi 5 task đã xong |
| Frontend chưa có unit/E2E test (Task 5.2 đang dở) | Regression UI không được phát hiện tự động | Bổ sung integration test tạo đơn/thanh toán + 1 E2E luồng menu → xác nhận đơn trước khi bàn giao |
