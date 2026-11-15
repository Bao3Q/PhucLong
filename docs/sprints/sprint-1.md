# Sprint 1 – Review & Retrospective

| | |
| --- | --- |
| **Thời gian** | 10/11/2026 – 12/11/2026 |
| **Sprint Goal** | Tạo nền tảng kỹ thuật, tài liệu có kiểm soát phiên bản và MVP đầu tiên chạy được cho luồng xem menu (Task 4). |
| **Thành viên** | Gia Báo · Nguyễn Thành Lộc · Anh Đức · Khánh Duy · Phan Tiến Đạt |
| **Ngày họp Review / Retro** | *(điền ngày họp)* |

> Nội dung “Đã bàn giao” lấy từ lịch sử commit/PR trên GitHub. Phần ý kiến (phản hồi, retro) là bản nháp đề xuất từ những gì đã xảy ra trong repo — **nhóm sửa lại cho đúng biên bản họp thật**.

## 1. Sprint Review

### Đã bàn giao (increment)

| Hạng mục | Kết quả | Minh chứng |
| --- | --- | --- |
| Task 4.1 Repository | Monorepo `apps/web`, `apps/api`, `docs`, `.gitignore`, `.env.example`, README | commit `Initial commit` (10/11) |
| Task 4.2 Tài liệu | Đưa Task 1–3 vào `docs/` (FR/NFR, use-case, sơ đồ activity/sequence/class) | commit `FR và NFR`, `Cap nhat so do diagrams` (12/11) |
| Task 4.3 MVP | `GET /products`, `GET /products/:id`; màn hình menu mobile-first có loading/empty/error; dữ liệu seed | commit `MVP sprint 1 , API products`, `giao dien` (11/11) |
| Task 4.4 CI | Pipeline lint + test + build khi mở PR | commit `chore(ci): configure eslint rules…` (11/11) |

### Demo
1. Mở menu → thấy khung loading, sau đó danh sách món; tắt API → hiện thông báo lỗi và nút “Thử lại”.
2. Gọi `GET /products/1` trả chi tiết món.
3. Mở một pull request → CI chạy lint/test/build.

### Phản hồi của khách hàng / giảng viên
- *(ghi lại phản hồi thật trong buổi review)*

### Chưa xong → chuyển sang Sprint 2
- Chi tiết món (size/topping), giỏ hàng, xác thực JWT, đặt đơn, thanh toán, lịch sử đơn (Task 5.1).
- Test component frontend, integration/E2E test (Task 5.2).

## 2. Sprint Retrospective

| Điều làm tốt | Điều chưa tốt | Hành động cải tiến (Sprint 2) | Người phụ trách |
| --- | --- | --- | --- |
| Có MVP chạy được sau 2 ngày, đủ 3 trạng thái loading/empty/error | Nhiều commit đẩy thẳng lên `main`, tên commit chưa thống nhất | Làm việc qua nhánh + pull request, đặt tên commit theo quy ước `feat/fix/chore(scope): …` | *(điền)* |
| CI chạy từ sớm | CI phải sửa nhiều lần vì `npm ci` lệch lockfile | Thống nhất phiên bản Node/npm, cập nhật lockfile khi thêm thư viện | *(điền)* |
| Tài liệu yêu cầu và sơ đồ có trong repo | Chưa có test frontend | Thêm test frontend vào Definition of Done của Sprint 2 | *(điền)* |
