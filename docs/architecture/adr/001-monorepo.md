# ADR-001: Dùng monorepo npm workspaces

- **Trạng thái**: Accepted
- **Ngày**: 2026-11-14

## Bối cảnh

Dự án có 2 ứng dụng (Next.js web, NestJS API) dùng chung cấu hình (.env.example, Dockerfile, docker-compose), chung CI pipeline và được phát triển bởi cùng một nhóm theo sprint.

## Quyết định

Một repository duy nhất với **npm workspaces**: `apps/web`, `apps/api`, tài liệu `docs/`, cấu hình CI/CD và Docker ở root.

## Hệ quả

- ✅ Một lệnh `npm run install:all`, `npm run build`, `npm test` chạy cho cả hệ thống; CI chỉ cần 1 workflow.
- ✅ Commit/PR thay đổi cả hai phía (ví dụ thêm field toppings) đi cùng nhau — hợp đồng API không bị lệch version.
- ✅ docker-compose và Dockerfile build từ context root, không cần sync 2 repo.
- ⚠️ Repo lớn dần theo thời gian; CI chạy cả 2 app kể cả khi chỉ đổi 1 app (chấp nhận, pipeline vẫn < 5 phút).
- ⚠️ Không tách quyền truy cập giữa web team và api team (không cần thiết ở quy mô nhóm học tập).
