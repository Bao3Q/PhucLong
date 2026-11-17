# Triển khai (Deployment) – BrewLite Phúc Long

> Task 5.3 – Continuous Delivery/Deployment và Task 5.4 – Triển khai và bàn giao.
> Sơ đồ: [`architecture/Task3_2_Deployment.svg`](architecture/Task3_2_Deployment.svg) (nguồn [`.puml`](architecture/Task3_2_Deployment.puml)) · Quyết định nền tảng: [ADR-004](architecture/adr/004-render-vercel-neon.md).

## 1. Môi trường

| Môi trường | Web (Next.js) | API (NestJS) | Database | Cách chạy |
| --- | --- | --- | --- | --- |
| **Local** | http://localhost:3000 | http://localhost:4000 | PostgreSQL 16 trong Docker (cổng 5433) | `docker compose up -d --build` (README mục 2) |
| **CI** (GitHub Actions) | `next start` trên runner | `node dist/main` trên runner | service `postgres:16-alpine` của job | `.github/workflows/ci.yml` |
| **Production** | Vercel – https://phuc-long-omega.vercel.app | Render (Docker) – https://phuclong-kf14.onrender.com | Neon PostgreSQL (không public, chỉ API kết nối qua TLS) | `.github/workflows/cd.yml` |

Health check production: https://phuclong-kf14.onrender.com/health → `{"status":"ok","database":"up",…}` (503 khi mất DB).

## 2. Pipeline CI/CD

```
Push/Tag → Lint & Test → Build → Docker Image → Push Registry → Deploy → Smoke Test
            (ci.yml)              (cd.yml: image)   (GHCR)    (Render)   (cd.yml: deploy)
```

| Bước | Ở đâu | Chi tiết |
| --- | --- | --- |
| Quality gate | `ci.yml` (cd.yml gọi lại bằng `workflow_call`) | Web: lint + build + unit test (Vitest). API: migration + unit test + integration test (PostgreSQL thật) + build. E2E Playwright menu → xác nhận đơn. Lỗi bất kỳ bước nào → dừng, không deploy. |
| Docker image | `cd.yml` → job `image` | Build `Dockerfile.api` (multi-stage, chạy bằng user `node`). Tag: `sha-<7 ký tự commit>`, `latest` (nhánh main), `X.Y.Z` khi push tag `vX.Y.Z`. |
| Push registry | GitHub Container Registry | `ghcr.io/bao3q/phuclong-api`, đăng nhập bằng `GITHUB_TOKEN` của workflow (không cần secret riêng). |
| Migration | job `deploy` | `prisma migrate deploy` (forward-only) chạy **trước** khi đổi code bằng secret `PROD_DATABASE_URL`; lỗi → dừng pipeline, bản đang chạy không bị ảnh hưởng. Container cũng chạy lại lệnh này khi khởi động (idempotent). |
| Deploy | job `deploy` | Gọi Render Deploy Hook (secret). Nếu service Render chạy từ image (`RENDER_IMAGE_DEPLOY=true`) thì deploy đúng image `sha-xxxxxxx` vừa build. Web: Vercel tự deploy khi có commit mới trên `main`. |
| Smoke test | job `deploy` | Chờ `/health` trả `database: up` (tối đa ~10 phút), gọi `GET /products`, kiểm tra header CORS cho domain Vercel, mở trang web. |
| Đánh dấu ổn định | job `deploy` | Smoke test đạt → gắn thêm tag `stable` cho image vừa deploy. |
| Rollback | job `deploy` (`if: failure()`) | Image mode: deploy lại `:stable`. Repo mode: gọi Render API rollback về bản deploy thành công trước (`RENDER_API_KEY`, `RENDER_SERVICE_ID`). Job vẫn báo đỏ để nhóm biết. |
| Release | job `release` (chỉ khi push tag) | Tạo GitHub Release, nội dung lấy từ `docs/release-notes/<tag>.md`. |

## 3. Secret và biến cấu hình

Secret **chỉ** nằm trong dashboard của nền tảng hoặc GitHub Secrets – không commit vào repo, không in ra log CI (`::add-mask::` mặc định của Actions che giá trị secret).

**GitHub → Settings → Secrets and variables → Actions**

| Tên | Loại | Dùng cho |
| --- | --- | --- |
| `RENDER_DEPLOY_HOOK_URL` | Secret | Render → service API → Settings → Deploy Hook |
| `RENDER_API_KEY` | Secret | Render → Account Settings → API Keys (rollback tự động) |
| `RENDER_SERVICE_ID` | Secret | Id service API, dạng `srv-…` (có trong URL dashboard) |
| `PROD_DATABASE_URL` | Secret | Chuỗi kết nối Neon (migration trước deploy) |
| `PROD_API_URL` | Variable | `https://phuclong-kf14.onrender.com` |
| `PROD_WEB_URL` | Variable | `https://phuc-long-omega.vercel.app` |
| `RENDER_IMAGE_DEPLOY` | Variable | `true` nếu service Render dùng *Existing Image* từ GHCR |

**Render (service API) → Environment**

| Biến | Giá trị |
| --- | --- |
| `DATABASE_URL` | chuỗi kết nối Neon (`?sslmode=require`) |
| `JWT_SECRET` | chuỗi ngẫu nhiên dài |
| `CORS_ORIGIN` | `https://phuc-long-omega.vercel.app` (nhiều domain thì cách nhau dấu phẩy, không có `/` cuối) |
| `NODE_ENV` | `production` |
| `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`, `SEPAY_API_KEY` | cấu hình SePay |

**Vercel (web) → Settings → Environment Variables**

| Biến | Giá trị | Ghi chú |
| --- | --- | --- |
| `API_PROXY_TARGET` | `https://phuclong-kf14.onrender.com` | Khuyên dùng: web gọi `/api/*` cùng domain, Next.js proxy sang API → không phụ thuộc CORS |
| `NEXT_PUBLIC_API_URL` | *(để trống)* | Chỉ đặt nếu muốn trình duyệt gọi thẳng API – khi đó **bắt buộc** `CORS_ORIGIN` trên Render phải có domain Vercel |

> Sự cố đã gặp (15/11): web production báo “Không thể kết nối máy chủ API” vì `NEXT_PUBLIC_API_URL` trỏ thẳng Render trong khi `CORS_ORIGIN` chưa có domain Vercel (trình duyệt chặn CORS). Smoke test của `cd.yml` giờ kiểm tra header CORS để bắt lỗi này ngay sau deploy.

## 4. Thiết lập lần đầu

1. Render: service API dùng `Dockerfile.api`, health check path `/health`, đặt biến môi trường như mục 3. Tạo Deploy Hook.
2. (Tuỳ chọn, để deploy đúng image theo commit SHA) Render → service → Settings → *Image* → `ghcr.io/bao3q/phuclong-api:latest`, rồi đặt variable `RENDER_IMAGE_DEPLOY=true`. Nếu package GHCR để private, thêm credential GHCR trên Render.
3. GitHub: tạo các secret/variable ở mục 3; Settings → Environments → `production` (có thể bật *Required reviewers* để duyệt trước khi deploy).
4. Vercel: import repo, root `apps/web`, đặt `API_PROXY_TARGET`.
5. Bật branch protection cho `main`: bắt buộc PR + các check của `ci.yml` phải xanh.

## 5. Phát hành phiên bản

```bash
git checkout main && git pull
git tag -a v1.0.0 -m "BrewLite Phúc Long v1.0.0"
git push origin v1.0.0
```

Push tag sẽ chạy `cd.yml`: quality gate → image `1.0.0` + `sha-…` → deploy → smoke test → GitHub Release với nội dung `docs/release-notes/v1.0.0.md`.

## 6. Rollback

- **Tự động**: smoke test lỗi → job `deploy` rollback như mục 2 và dừng pipeline.
- **Thủ công**: README mục 7 (Vercel *Promote to Production* bản cũ · Render *Deploys → Rollback* · Neon *Point-in-Time Restore*).
- **Theo image**: Render (image mode) đổi image sang tag cũ, ví dụ `ghcr.io/bao3q/phuclong-api:sha-3889d0a` hoặc `:stable`, rồi *Manual Deploy*.
- Migration là forward-only: rollback code **không** quay ngược schema; nếu schema mới không tương thích bản cũ thì khôi phục DB từ backup Neon (README mục 7.3).

## 7. Kiểm tra nhanh sau deploy

```bash
curl -i https://phuclong-kf14.onrender.com/health
curl -i -H "Origin: https://phuc-long-omega.vercel.app" https://phuclong-kf14.onrender.com/products   # phải có Access-Control-Allow-Origin
```
Trên PowerShell dùng `curl.exe` thay cho `curl`.
