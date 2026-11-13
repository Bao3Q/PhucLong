# Timeline BrewLite – Assignment 2

## 0. Giả định

- Nhóm **4 người**, mỗi người khoảng **10–15 giờ/tuần**.
- Timeline **8 tuần**. Tuần 1 bắt đầu **16/11/2026** — chỉnh lại theo deadline thực tế.
- MVP ưu tiên luồng: **Menu → Chi tiết/size/topping → Giỏ hàng → Đặt đơn → Thanh toán mô phỏng → Theo dõi đơn**.
- Chọn nền tảng deploy từ tuần 1: Render / Railway / Fly.io + PostgreSQL (Neon, Supabase hoặc Postgres có persistent disk).
- Làm theo đúng thứ tự Task 1 → 5. Tạo phẩm của task trước phải nằm trên repo trước khi sang task sau.

## 1. Vai trò

| Vai trò | Trách nhiệm chính |
|---|---|
| PO/BA | Task 1, SRS, use-case, acceptance criteria, traceability |
| Backend/Tech lead | Task 3, schema, NestJS, auth, order, payment, loyalty |
| Frontend | Next.js/PWA: menu, cart, checkout, trạng thái đơn |
| DevOps/QA | Repo, CI/CD, Docker, test, deploy, health check, demo |

> Nếu nhóm 3 người: gộp PO/BA vào Frontend, gộp DevOps/QA vào Backend. Nếu 2 người: ưu tiên backend + deploy trước, frontend làm sau.

## 2. Timeline tổng quan

| Tuần | Mục tiêu | Công việc chính | Tạo phẩm / Gate |
|---|---|---|---|
| 1 | Khởi động + Task 1 | Kickoff, chốt scope, repo, backlog; context & scope; SRS | `docs/requirements/context-and-scope.md`, SRS, issue board, README, `.env.example` |
| 2 | Task 1 + Task 2 | Hoàn thiện use-case; activity, sequence, class diagram | Use-case spec; `.puml` + `.svg` cho 3 sơ đồ |
| 3 | Task 3 + nền tảng | Kiến trúc, ADR, deployment diagram; DB migration/seed; API skeleton | `docs/architecture/*`, deployment diagram; chạy local được |
| 4 | Sprint 1 | API products, menu mobile-first, loading/empty/error, test; CI | Tag `v0.1.0`; CI xanh; minh chứng CI đỏ |
| 5 | Sprint 2 (1/2) | Auth JWT, product detail, size/topping, cart, tạo đơn + trừ kho | Luồng menu → cart → order chạy được |
| 6 | Sprint 2 (2/2) | Payment mock, idempotency, status/history, promotion, loyalty | Checkout thành công/thất bại; lịch sử đơn |
| 7 | Tích hợp + CD | Integration/E2E, docker-compose, health; CD, registry, deploy, smoke test, rollback | URL production + `/health` hoạt động |
| 8 | Hoàn thiện + bàn giao | Hardening, README, release notes, traceability, video, review/retro, buffer | Checklist nộp bài hoàn tất |

## 3. Chi tiết từng tuần

### Tuần 1 – Khởi động và Task 1

- Ngày 1: kickoff, chốt MVP, chọn platform deploy, tạo repo `apps/web`, `apps/api`, `docs`; branch strategy; quy ước commit.
- Task 1.1: stakeholder, in-scope/out-of-scope, giả định, ràng buộc, rủi ro.
- Task 1.2: FR/NFR có mã, MoSCoW, acceptance criteria, use-case tổng quát.
- Task 1.3: chọn use-case **Đặt và thanh toán đơn hàng**; actor, trigger, pre/post-condition, luồng chính/thay thế/ngoại lệ.
- Tạo backlog Sprint 1 và Sprint 2 trên issue board.

**Gate:** SRS không còn mục TBD; mỗi FR có acceptance criteria kiểm chứng được.

### Tuần 2 – Task 2: Mô hình hóa

- Activity diagram end-to-end, có swimlane; nhánh hết hàng, chưa đăng nhập, thanh toán thất bại.
- Sequence diagram checkout: Customer → Next.js → NestJS → DB → Payment Service; JWT, validate, transaction, inventory, alt success/fail, idempotency.
- Class diagram domain: `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`, `Ingredient`; thuộc tính, quan hệ, multiplicity, enum trạng thái.
- Lưu cả file nguồn `.puml` và ảnh `.svg`.

**Gate:** 3 sơ đồ không mâu thuẫn với SRS/use-case; đã commit lên `main`.

### Tuần 3 – Task 3: Kiến trúc và nền tảng kỹ thuật

- Mô tả kiến trúc theo C4 hoặc phân lớp: Next.js, NestJS module/domain, PostgreSQL, payment mock.
- ADR ngắn: monorepo, module backend, migration, payment mock, lựa chọn platform deploy.
- Deployment diagram production: browser/PWA, CDN/Next.js, API container, PostgreSQL persistent, registry, HTTPS, secrets, health check, log, ranh giới local/CI/prod.
- Dựng Prisma schema/migration/seed; `docker-compose.yml` cho Postgres; health endpoint; API skeleton.
- **Deploy thử bản skeleton lên production ngay trong tuần này** để de-risk.

**Gate:** Task 1–3 có đủ trên repo; một người khác clone về chạy được theo README.

### Tuần 4 – Sprint 1

- `GET /products`, `GET /products/:id`.
- Màn hình menu mobile-first; loading, empty, error states.
- Seed dữ liệu mẫu; unit test API + test component/luồng chính.
- CI: Install → Lint → Unit Test → Build; bật branch protection, PR đỏ không được merge.
- Sprint Review, demo, tag `v0.1.0`.

**Gate:** CI xanh trên PR; có ảnh/log một lần pipeline lỗi và một lần thành công.

### Tuần 5 – Sprint 2: Auth, cart, order

- Đăng ký/đăng nhập, hash password, JWT, guard role `CUSTOMER/ADMIN`.
- Product detail: size S/M/L, topping, giá theo size.
- Cart: thêm/xóa/sửa số lượng, tính subtotal/total.
- Tạo đơn trong transaction: kiểm tra tồn kho → tạo Order/OrderItem → trừ kho.
- Bắt đầu integration test cho tạo đơn.

**Gate:** Đăng nhập → chọn món → cart → tạo đơn thành công; hết hàng bị chặn đúng.

### Tuần 6 – Sprint 2: Payment, trạng thái, promotion, loyalty

- `POST /payments` mô phỏng Ví/Thẻ; idempotency key; một đơn chỉ có tối đa một payment `SUCCESS`.
- Xử lý success/fail → cập nhật `OrderStatus` đúng.
- Lịch sử đơn, chi tiết trạng thái đơn.
- Promotion: áp voucher, tính discount, kiểm tra hạn mức.
- Loyalty: cộng điểm khi hoàn tất, trừ điểm khi redeem, lưu `LoyaltyTransaction`.
- Validate và xử lý lỗi ở cả frontend/backend.

**Gate:** Checkout happy path + failure path + retry cùng idempotency key đều đúng.

### Tuần 7 – Tích hợp, E2E, CI/CD và production

- Integration test API tạo đơn/thanh toán; ít nhất 1 E2E từ menu đến xác nhận đơn.
- `docker-compose.yml` chạy web + API + DB ở local.
- Health endpoint `GET /health`.
- CD: lint/test/build → build Docker image tag commit SHA/semver → push registry → deploy → migration an toàn → smoke test → rollback.
- Kiểm tra secrets không nằm trong repo/log; DB production không public.

**Gate:** URL frontend HTTPS + URL API + health check hoạt động; smoke test xanh; có tài liệu rollback.

### Tuần 8 – Hoàn thiện và bàn giao

- Sửa bug, kiểm tra bảo mật cơ bản: JWT hết hạn, CORS, validate input, không lộ secret.
- README: chạy local, test, build, deploy, rollback.
- Release tag + release notes; hoàn thiện `docs/traceability-matrix.md`.
- Quay video demo end-to-end; chuẩn bị Sprint Review/Retrospective.
- Buffer 2 ngày cuối để xử lý sự cố.

**Gate:** Một người ngoài nhóm clone repo, làm theo README và truy cập được production.

## 4. Critical path

1. **Chốt schema + auth + order transaction sớm** — đây là phần dễ trễ nhất.
2. **Payment idempotency và chuyển trạng thái đơn** — làm và test ngay tuần 6, không để tuần 8.
3. **Deploy sớm** — ít nhất bản skeleton ở tuần 3–4; Task 5 không tính nếu không có URL production hoạt động.
4. **CI từ tuần 4** — tránh cuối kỳ mới phát hiện lint/test/build lỗi.
5. **Docs commit dần** — Task sau chỉ được nghiệm thu khi tạo phẩm task trước đã có trên repo.

## 5. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
|---|---|
| Scope creep | Freeze MVP sau tuần 3; đưa tính năng mới vào "Could/Won't" |
| Deploy trễ | Deploy skeleton từ tuần 3; chọn platform có free tier + Postgres persistent |
| Payment/transaction sai | Viết integration test cho success, fail, retry; dùng idempotency key |
| Free tier ngủ đông | Health check có retry; keep-alive; chấp nhận cold start hoặc nâng gói |
| JWT/CORS lỗi trên production | Test từ frontend đã deploy, không chỉ localhost |
| Thành viên vắng | Pair + tài liệu hóa; không để single owner |

## 6. Nhịp làm việc

- **Thứ 2:** planning 30 phút, chốt việc tuần.
- **Thứ 4:** check-in 15 phút, xử lý blocker.
- **Thứ 6:** demo + merge + cập nhật issue board.
- PR nhỏ (≤ 400 dòng), review trong 24h.
- Definition of Done: code + test + migration/seed + docs/API + review + CI xanh + chạy được trên staging.

## 7. Phương án nén timeline

### Còn 6 tuần

- Tuần 1: Task 1 + Task 2.
- Tuần 2: Task 3 + repo/DB.
- Tuần 3–4: Sprint 1 + CI.
- Tuần 5: Sprint 2 core (auth, cart, order, payment).
- Tuần 6: deploy + test + docs + demo.

### Còn 4 tuần

- Tuần 1: Task 1–2 + repo.
- Tuần 2: Task 3 + Sprint 1.
- Tuần 3: Sprint 2 core + payment.
- Tuần 4: deploy + integration/E2E + docs + video.
- Cắt bớt: UI promotion/loyalty nâng cao; vẫn giữ schema + logic cơ bản.

### Còn 3 tuần

- Tuần 1: docs Task 1–3 + skeleton + auth/menu.
- Tuần 2: cart/order/payment + status.
- Tuần 3: deploy + test + README + video.
- Cắt bớt: admin UI, promotion/loyalty nâng cao, polish giao diện.

> Dù nén thế nào, vẫn phải có đủ: docs Task 1–3, 4 sơ đồ, migration/seed, test, CI/CD, URL production + health check, README/rollback và video demo.

## 8. Checklist nộp bài

- [ ] Link repository + quyền truy cập cho giảng viên
- [ ] SRS, đặc tả use-case, ma trận truy vết
- [ ] Activity, sequence, class, deployment diagram (nguồn + ảnh)
- [ ] Source code frontend, backend, migration/seed
- [ ] Unit, integration, E2E test
- [ ] Pipeline CI/CD chạy thành công (có minh chứng)
- [ ] URL production, API, health check
- [ ] Release notes, README, hướng dẫn rollback
- [ ] Video demo + Sprint Review/Retrospective
