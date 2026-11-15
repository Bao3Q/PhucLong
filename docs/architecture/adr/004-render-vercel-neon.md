# ADR-004: Deploy trên Vercel (web) + Render (API Docker) + Neon (PostgreSQL)

- **Trạng thái**: Accepted
- **Ngày**: 2026-11-14

## Bối cảnh

Đề bài yêu cầu production truy cập được qua HTTPS, database không public trực tiếp, và deployment diagram phải phản ánh đúng nền tảng thực tế. Nhóm dùng tier miễn phí của các nhà cung cấp PaaS.

## Quyết định

| Thành phần | Nền tảng | Cách chạy |
| --- | --- | --- |
| Web Next.js | **Vercel** — https://phuc-long-omega.vercel.app/ | Build trực tiếp từ repo, root directory `apps/web` |
| API NestJS | **Render** — https://phuclong-kf14.onrender.com/ | Runtime **Docker** (đóng gói bằng Dockerfile), Pre-Deploy Command chạy `prisma migrate deploy` |
| PostgreSQL | **Neon** | Connection string có `?sslmode=require`, không public; backup/PITR trước deploy có migration |

Smoke test sau deploy: `GET /health` phải trả 200. Secrets (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`) chỉ đặt trong dashboard từng nền tảng.

## Hệ quả

- ✅ Không phải vận hành VPS; deploy tự động khi push/merge.
- ✅ Rollback từng thành phần độc lập: Vercel Promote / Render Rollback / Neon restore (README mục 7).
- ⚠️ Render free tier **ngủ sau idle** — request đầu có thể chậm ~30s; mitigate bằng health check định kỳ.
- ⚠️ Next.js chạy trên Vercel (không dùng Docker cho web) — Dockerfile của repo dùng cho demo local; image production API riêng cho Render (đang hoàn thiện theo README 6.5).
- ⚠️ Neon region có thể khác region Render → độ trễ DB vài chục ms (chấp nhận với NFR-01 < 500ms).
