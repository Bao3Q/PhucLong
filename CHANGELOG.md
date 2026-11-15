# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [Semantic Versioning](https://semver.org/).
Chi tiết từng bản phát hành: [`docs/release-notes/`](docs/release-notes/).

## [Unreleased]

### Added
- Sơ đồ use-case tổng quát (`Task1_2_UseCase`) và use-case UC-01 (`Task1_3_UseCase`) có file nguồn PlantUML.
- FR-09 quản lý trạng thái đơn; NFR-05 tính sẵn sàng, NFR-06 secret & log; MoSCoW cho NFR-01.
- Đặc tả UC-01: trigger, luồng thay thế và luồng ngoại lệ tách riêng.
- Deployment diagram mới (`Task3_2_Deployment.puml`): local / CI / production, GHCR, secret, health check, log; bảng truy vết node → mã nguồn.
- PWA: web app manifest, icon, theme color.
- ESLint cho `apps/api`, chạy trong CI (job Backend CI).

## [1.0.0] – 2026-11-15

### Added
- Sprint 2 – CI/CD & Delivery: integration test API (`tests/api`), E2E Playwright (`tests/e2e`), unit test frontend (`tests/web`), pipeline CD (`.github/workflows/cd.yml`), `docs/deployment.md`, release notes, Sprint Review/Retrospective.
- Task 9: màn hình xác nhận đơn `/orders/[id]` và lịch sử đơn `/orders` (#5, #6).
- Thanh toán online SePay QR + webhook; công thức pha chế, trừ nguyên liệu/ly theo size.
- Task 7: đăng ký/đăng nhập JWT, phân quyền ADMIN/CUSTOMER (#1–#4).
- API đơn hàng, thanh toán mô phỏng có idempotency, khuyến mãi, điểm thưởng.
- Prisma 7 + migration/seed PostgreSQL, `docker-compose.yml`, `GET /health`.

### Changed
- CORS chỉ cho phép domain trong `CORS_ORIGIN`; Dockerfile tách `Dockerfile.api` / `Dockerfile.web` dùng node_modules hoist (#7).

## [0.1.0] – 2026-11-11 (Sprint 1)

### Added
- Khởi tạo monorepo `apps/web`, `apps/api`, `docs`; tài liệu Task 1–3 (yêu cầu, sơ đồ, kiến trúc, ADR).
- MVP Sprint 1: `GET /products`, `GET /products/:id`, màn hình menu mobile-first với loading/empty/error.
- CI cơ bản: lint + test + build khi mở pull request.

[Unreleased]: https://github.com/Bao3Q/PhucLong/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Bao3Q/PhucLong/releases/tag/v1.0.0
