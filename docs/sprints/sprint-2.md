# Sprint 2 – Review & Retrospective

| | |
| --- | --- |
| **Thời gian** | 13/11/2026 – 15/11/2026 |
| **Sprint Goal** | Hoàn thành luồng end-to-end, tự động hóa đóng gói và triển khai một phiên bản production truy cập được (Task 5). |
| **Thành viên** | Gia Báo · Nguyễn Thành Lộc · Anh Đức · Khánh Duy · Phan Tiến Đạt |
| **Ngày họp Review / Retro** | 15/11/2026 |
| **Phiên bản** | v1.0.0 – [release notes](../release-notes/v1.0.0.md) |

> “Đã bàn giao” lấy từ lịch sử commit/PR. Phần phản hồi và retro là bản nháp đề xuất — **nhóm sửa lại theo biên bản họp thật**.

## 1. Sprint Review

### Đã bàn giao (increment)

| Hạng mục | Kết quả | Minh chứng |
| --- | --- | --- |
| Task 5.1 Xác thực | Đăng ký/đăng nhập JWT, phân quyền ADMIN/CUSTOMER | PR #1–#4 (Anh Đức) |
| Task 5.1 Đặt đơn & thanh toán | Tạo đơn, thanh toán MoMo/Thẻ mô phỏng có idempotency, SePay QR + webhook, trừ nguyên liệu/ly trong transaction, khuyến mãi, điểm thưởng | commit `them orders api`, `them payment api`, `them thanh toan online`, `them cong thuc…` |
| Task 5.1 Xác nhận & lịch sử đơn | `/orders/[id]` (tự cập nhật khi PENDING), `/orders` | PR #5, #6 (Phan Tiến Đạt, Gia Báo) |
| Task 5.2 Kiểm thử | Unit test API; integration test API trên PostgreSQL thật (`tests/api`); E2E Playwright menu → xác nhận đơn (`tests/e2e`); unit/component test web (`tests/web`) | `.github/workflows/ci.yml` |
| Task 5.2 Hạ tầng | Prisma migration + seed, `docker-compose.yml`, `GET /health` | `apps/api/prisma/migrations`, PR #7 |
| Task 5.3 CD | Image tag commit SHA → GHCR → migration → deploy Render → smoke test → rollback | `.github/workflows/cd.yml`, [deployment.md](../deployment.md) |
| Bổ sung sau review | Sơ đồ use-case tổng quát + UC-01 (PlantUML), FR-09 quản lý trạng thái đơn, NFR-05/06, đặc tả use-case có trigger và luồng ngoại lệ, deployment diagram đầy đủ (registry, CI, secret, log), PWA manifest, ESLint backend trong CI | `docs/diagrams/Task1_*_UseCase.*`, `docs/architecture/Task3_2_Deployment.*`, `apps/web/app/manifest.ts`, `apps/api/eslint.config.mjs` |
| Task 5.4 Bàn giao | Web Vercel, API Render, DB Neon; README chạy local/test/build/deploy/rollback; release v1.0.0 | README mục 5–7 |

### Demo
1. Menu → chọn món, size, topping → giỏ hàng → đăng nhập → thanh toán MoMo → màn hình đặt hàng thành công → xác nhận đơn “Đã thanh toán” → lịch sử đơn.
2. Thanh toán lặp lại cùng Idempotency-Key không trừ kho lần hai.
3. Pipeline CD: push tag `v1.0.0` → image `sha-…` trên GHCR → deploy → smoke test xanh.

### Phản hồi của khách hàng / giảng viên
- Hệ thống đáp ứng tốt luồng mua hàng end-to-end từ xem menu, tùy chọn sản phẩm, giỏ hàng đến thanh toán và theo dõi đơn hàng.
- Pipeline CD hoạt động tự động, có kiểm thử smoke test và phương án rollback an toàn khi xảy ra lỗi cấu hình.
- Cần tiếp tục duy trì việc cập nhật tài liệu kỹ thuật đồng bộ với mã nguồn ở các phiên bản tiếp theo.

### Sự cố trong Sprint
- **15/11 – web production không gọi được API**: sau khi siết CORS về `CORS_ORIGIN`, biến này trên Render chưa có domain Vercel nên trình duyệt chặn request. Khắc phục: đặt `CORS_ORIGIN` (hoặc dùng proxy `API_PROXY_TARGET`); bổ sung kiểm tra CORS vào smoke test của CD để phát hiện ngay sau deploy.

### Chưa xong / tồn đọng
- Tối ưu hóa thời gian khởi động (cold start ~30s) trên hạ tầng Render Free tier.
- Bổ sung bộ kiểm thử tự động đo lường hiệu năng p95 dưới 500ms (NFR-01) ở Sprint sau.

## 2. Sprint Retrospective

| Điều làm tốt | Điều chưa tốt | Hành động cải tiến | Người phụ trách |
| --- | --- | --- | --- |
| Hoàn thành đủ luồng end-to-end, có production chạy được | Thay đổi cấu hình (CORS) đi thẳng lên production mà không có kiểm tra sau deploy | Smoke test tự động (đã thêm), checklist biến môi trường khi đổi cấu hình bảo mật | Gia Báo |
| Làm việc qua pull request (#1–#7), có review | Nhiều tính năng dồn vào 2 ngày cuối | Chia nhỏ issue, cập nhật board hằng ngày | Phan Tiến Đạt |
| Thanh toán có idempotency + transaction, có test | Test frontend và E2E bổ sung muộn | Viết test cùng lúc với tính năng (đưa vào Definition of Done) | Anh Đức |
| Có tài liệu triển khai và rollback | Một số tài liệu (README, traceability) cập nhật chậm so với code | Mỗi PR cập nhật README/traceability nếu đổi API hoặc tính năng | Nguyễn Thành Lộc |
