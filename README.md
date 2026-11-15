# BrewLite - Phúc Long Coffee & Tea Platform

Dự án bài tập lớn môn **Công nghệ Phần mềm** (Assignment 2: Requirements to Deployment).

## 1. Cấu trúc Monorepo

```text
PhucLong/
├── apps/
│   ├── web/               # Next.js mobile-first / PWA
│   └── api/               # NestJS RESTful API
├── docs/                  # Tài liệu phân tích, thiết kế, kiến trúc (Task 1 -> 3)
│   ├── requirements/      # SRS & Phạm vi
│   ├── diagrams/          # Activity, Sequence, Class Diagrams (.puml & .svg)
│   ├── architecture/      # Kiến trúc, ADRs
│   ├── release-notes/     # Release notes từng phiên bản
│   ├── sprints/           # Sprint Review & Retrospective
│   ├── deployment.md      # Môi trường, pipeline CD, secret, rollback
│   └── traceability-matrix.md # Ma trận truy vết
├── tests/                 # Integration (api), E2E (e2e), unit frontend (web)
├── .github/
│   └── workflows/
│       ├── ci.yml         # CI: lint, unit, integration, E2E, build
│       └── cd.yml         # CD: image → GHCR → migrate → deploy → smoke test → rollback
├── Dockerfile.api         # Image production API (Render)
├── Dockerfile.web         # Image web (docker compose local)
├── docker-compose.yml     # Chạy local: Web + API + PostgreSQL
├── CHANGELOG.md           # Lịch sử phiên bản
├── .env.example           # Biến môi trường mẫu
└── README.md
```

## 2. Chạy môi trường Local

### 2.1 Chuẩn bị
Yêu cầu: **Node.js >= 20**, **Docker Desktop** (nếu chạy bằng Docker).

```bash
git clone https://github.com/Bao3Q/PhucLong.git
cd PhucLong
cp .env.example .env
```

### 2.2 Cách 1 — Docker Compose (khuyên dùng)

Một lệnh duy nhất, tự khởi tạo database và chạy migration:

```bash
docker compose up --build
```

| Thành phần | Địa chỉ |
| --- | --- |
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:4000 |
| PostgreSQL | localhost:5433 |

Container `app` tự động chạy `prisma generate` + `prisma migrate deploy` khi khởi động, nên database luôn được tạo bảng và seed đúng phiên bản migration mới nhất.

### 2.3 Cách 2 — Chạy trực tiếp bằng npm (dev mode, hot-reload)

Cần một PostgreSQL đang chạy. Có hai lựa chọn:
- PostgreSQL hệ thống trên cổng **5432** (khớp mặc định `DATABASE_URL` trong `.env`).
- Hoặc dùng container của repo: `docker compose up -d postgres` — lưu ý compose map ra cổng **5433**, khi đó sửa `DATABASE_URL` trong `.env` thành `postgresql://postgres:postgres@localhost:5433/phuclong_db?schema=public`.

Cài đặt và chạy:

```bash
npm run install:all          # cài dependencies cho root + api + web
npm run dev                  # chạy đồng thời API (4000) + Web (3000), hot-reload
```

Hoặc chạy từng terminal riêng nếu muốn xem log tách biệt:

```bash
# Terminal 1 — API
cd apps/api && npm run start:dev

# Terminal 2 — Web
cd apps/web && npm run dev
```

Khi chạy bằng npm, áp dụng migration thủ công (chỉ cần làm một lần sau khi đổi schema):

```bash
cd apps/api && npx prisma migrate deploy
```

### 2.4 Thanh toán online SePay (chuyển khoản QR)

Cấu hình trong `.env` (xem `.env.example`): `SEPAY_ACC`, `SEPAY_BANK`, `SEPAY_API_KEY`, `SEPAY_QR_BASE`, `SEPAY_TIMEOUT_SECONDS` (mặc định **120 giây = 2 phút**).

- Trên [my.sepay.vn](https://my.sepay.vn): link tài khoản ngân hàng nhận tiền và tạo webhook trỏ tới `<API_URL>/payments/sepay/webhook`.
- Luồng: tạo phiên → quét QR chuyển khoản kèm mã `PL…` → SePay gọi webhook khi tiền vào → API tự đối soát mã + số tiền, trừ kho và đánh dấu đơn `PAID`. Quá 2 phút chưa nhận tiền, phiên chuyển `EXPIRED`.

### 2.5 Xác nhận & lịch sử đơn (Task 9)

| Thành phần | Mô tả |
| --- | --- |
| `GET /orders/me` | Lịch sử đơn của người đang đăng nhập, mới nhất trước. Cần JWT (thiếu/sai → 401). |
| `GET /orders/:id` | Chi tiết một đơn cho màn hình xác nhận: mã đơn `#id`, trạng thái, món, tổng tiền. Chỉ chủ đơn hoặc ADMIN (người khác → 403, không có đơn → 404). Không trả `userId`. |
| `/orders` (web) | Trang **Lịch sử đơn**: đang tải · cần đăng nhập · lỗi (thử lại) · chưa có đơn · danh sách. Mở từ menu “Lịch sử đơn” ở header. |
| `/orders/[id]` (web) | Trang **Xác nhận đơn**: mã đơn lớn, nhãn trạng thái có màu, danh sách món, giảm giá, tổng tiền. Đơn còn `PENDING` thì tự hỏi lại mỗi 3 giây (tối đa 20 lần). |
| `/order-success` (web) | Thêm nút “Xem chi tiết đơn” và “Lịch sử đơn”. |

Test nhanh bằng Thunder Client / Postman (API ở `http://localhost:4000`):

1. `POST /auth/register` rồi `POST /auth/login` (body `{"email":"a@phuclong.vn","password":"12345678"}`) → lấy `accessToken` = **TOKEN_A**; làm tương tự cho tài khoản B → **TOKEN_B**.
2. `POST /orders` (Bearer TOKEN_A) với body `{"items":[{"productId":"1","size":"M","qty":1,"toppings":[]}]}` → ghi lại `id`.
3. `GET /orders/me`: không token → **401**; TOKEN_A → **200** (có đơn vừa tạo); TOKEN_B → **200** (không có đơn của A).
4. `GET /orders/<id>`: TOKEN_A → **200**; TOKEN_B → **403**; `/orders/999999` → **404**; không token → **401**.

---

## 3. Kiểm thử (Test)

| Lệnh (chạy ở thư mục gốc) | Loại | Cần gì |
| --- | --- | --- |
| `npm --prefix apps/web run lint` | ESLint frontend | — |
| `npm --prefix apps/api run lint` | ESLint backend (typescript-eslint) | — |
| `npm run test` | Unit test API (Jest, in-memory) | — |
| `npm run test:e2e:api` | Integration test API: HTTP + PostgreSQL thật (`tests/api`) | `DATABASE_URL` tới DB đã migrate |
| `npm run test:web` | Unit/component test frontend (Vitest, `tests/web`) | — |
| `npm run test:e2e` | E2E Playwright menu → xác nhận đơn (`tests/e2e`) | web :3000 + API :4000 đang chạy |

Chi tiết từng loại và cách chạy: [`tests/README.md`](tests/README.md). Mã test (API-T, INT-T, WEB-T, E2E-T) khớp [ma trận truy vết](docs/traceability-matrix.md).
CI (`.github/workflows/ci.yml`) chạy toàn bộ các bước trên ở mỗi pull request; PR chỉ được merge khi tất cả xanh.

## 4. Build

### 4.1 Build ứng dụng

```bash
npm run build                         # build cả API + Web song song
# hoặc từng thành phần:
npm --prefix apps/api run build       # nest build (prebuild tự chạy prisma generate)
npm --prefix apps/web run build       # next build
```

Chạy API ở chế độ production sau khi build:

```bash
cd apps/api && npm run start:prod     # node dist/main
```

### 4.2 Build Docker image

```bash
docker build -f Dockerfile.api -t phuclong-api:local .   # image production API (giống bản trên Render)
docker build -f Dockerfile.web -t phuclong-web:local .
docker compose up -d --build                             # hoặc build + chạy cả 3 service
```

Image API do pipeline CD build được đẩy lên `ghcr.io/bao3q/phuclong-api` với tag `sha-<commit>`, `latest` và `X.Y.Z` (khi gắn tag phiên bản).

---

## 5. Deploy

| Thành phần | Nền tảng | URL |
| --- | --- | --- |
| Web (Next.js) | Vercel | https://phuc-long-omega.vercel.app/ |
| API (NestJS) | Render (Docker) | https://phuclong-kf14.onrender.com/ |
| Health check | Render | https://phuclong-kf14.onrender.com/health |
| PostgreSQL | Neon | — (connection string không public) |

Chi tiết lựa chọn nền tảng: [ADR-004](docs/architecture/adr/004-render-vercel-neon.md).

### 5.1 Pipeline CI/CD

```
Push/Tag → Lint & Test → Build → Docker Image → Push Registry → Deploy → Smoke Test
```

- **CI** (`ci.yml`) – mỗi pull request: lint, unit test API + web, integration test API (PostgreSQL), E2E Playwright, build.
- **CD** (`cd.yml`) – push `main` hoặc tag `vX.Y.Z`: chạy lại CI → build image tag commit SHA → push GHCR → `prisma migrate deploy` → deploy Render bằng secret → smoke test (`/health`, `/products`, CORS, web) → lỗi thì rollback và dừng pipeline → tag thì tạo GitHub Release.
- Secret cần tạo, thiết lập lần đầu và cách phát hành phiên bản: [`docs/deployment.md`](docs/deployment.md).

---

## 6. Checklist cần hoàn thiện trước khi go-live

- [x] **Dockerfile production cho API**: `Dockerfile.api` multi-stage, chạy `prisma migrate deploy && node dist/main` bằng user `node`.
- [x] **Endpoint `GET /health`** (NFR-04): 200 `{"status":"ok","database":"up"}` khi DB sẵn sàng, 503 khi DB mất.
- [x] **CD pipeline** (Task 5.3): `.github/workflows/cd.yml`.
- [ ] **Cấu hình secret cho CD** trên GitHub (`RENDER_DEPLOY_HOOK_URL`, `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `PROD_DATABASE_URL`) – xem `docs/deployment.md` mục 3.
- [ ] **CORS production**: Render `CORS_ORIGIN=https://phuc-long-omega.vercel.app` (hoặc web dùng proxy `API_PROXY_TARGET`).
- [ ] **Branch protection** cho `main`: bắt buộc PR + check CI xanh.
- [ ] **Gắn tag `v1.0.0`** để tạo release (`docs/release-notes/v1.0.0.md`).
- [x] **Secrets** chỉ đặt trong dashboard Render/Vercel/Neon và GitHub Secrets, không commit vào repo.

---

## 7. Rollback

### 7.1 Web (Vercel)
Vercel giữ mọi bản deploy bất biến:
**Project → Deployments → chọn bản deploy ổn định trước đó → ... → Promote to Production.** Hoàn tất tức thì, không cần build lại.

### 7.2 API (Render)
**Service → Deploys → chọn deploy ổn định trước đó → Rollback.** Render quay lại đúng image của bản deploy cũ. Sau rollback, chạy lại smoke test `GET /health`.

### 7.3 Database (Neon)
- **Trước mỗi deploy có migration**: tạo snapshot/branch backup trên Neon.
- Nếu cần phục hồi: dùng **Point-in-Time Restore** hoặc khôi phục branch backup trên Neon dashboard.
- Lưu ý quan trọng: Prisma migration là **forward-only** (không có down migration). Khi rollback code mà schema đã đổi, không quay ngược schema bằng tay — xử lý bằng `npx prisma migrate resolve` để đánh dấu trạng thái migration, hoặc khôi phục database từ backup Neon.

### 7.4 Quy trình rollback toàn hệ thống
Thực hiện theo nguyên nhân lỗi:

**Lỗi ứng dụng không liên quan đến migration**
1. Rollback **API** trên Render.
2. Smoke test API và các luồng chính.
3. Chỉ rollback **Web** trên Vercel nếu lỗi nằm ở frontend.
4. Kiểm tra lại toàn bộ luồng; chỉ mở lại hệ thống sau khi xác nhận hoạt động bình thường.

**Lỗi do migration hoặc schema database**
1. Tạm dừng nhận ghi dữ liệu mới để tránh phát sinh dữ liệu không nhất quán.
2. Khôi phục database từ backup/snapshot Neon về trạng thái tương thích với bản API trước đó (mục 7.3).
3. Rollback **API** trên Render về bản tương thích với schema đã khôi phục.
4. Smoke test kết nối DB, API và các luồng chính.
5. Chỉ rollback **Web** trên Vercel nếu cần; xác nhận hệ thống ổn định rồi mới nhận lại traffic.

Sau khi rollback, ghi nhận tag release cũ để có thể redeploy: `git checkout v<x.y.z>` nếu cần xuất phát lại từ mã nguồn.

### 7.5 Rollback transaction thanh toán trong ứng dụng
Khi xử lý thanh toán, API thực hiện các thao tác sau trong cùng một Prisma transaction (`apps/api/src/payments/payments.service.ts`):
1. Trừ tồn kho nguyên liệu và ly.
2. Cập nhật trạng thái đơn thành `PAID`.
3. Ghi nhận thanh toán.

Nếu một bước thất bại, transaction tự rollback các thay đổi database ở cả ba bước. Đơn hàng đã được tạo trước đó vẫn còn và không được thanh toán; rollback này không phải là rollback bản deploy hay khôi phục toàn bộ database.

---

## 8. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
| --- | --- |
| API báo lỗi kết nối DB (Prisma `P1001`) | Database chưa sẵn sàng hoặc `DATABASE_URL` sai cổng. Chạy bằng npm + compose postgres thì phải dùng cổng **5433** (xem mục 2.3). |
| Web gọi API bị lỗi CORS | `CORS_ORIGIN` trên Render chưa trùng domain Vercel (kể cả có/không có `www`). |
| Web vẫn gọi API localhost sau khi deploy | `NEXT_PUBLIC_API_URL` là biến build-time — đổi env trên Vercel xong phải **Redeploy**. |
| `docker compose up` báo lỗi `.env.example` không tồn tại | Chạy lệnh từ thư mục root của monorepo, không chạy trong `apps/*`. |
| Đăng nhập báo 401 sau khi đổi `JWT_SECRET` | Token cũ ký bằng secret cũ — đăng nhập lại để nhận token mới. |

---

## 9. Quy trình làm việc nhóm

### 9.1 Nhánh và pull request
- `main` luôn deploy được; không push thẳng – mọi thay đổi qua pull request, CI phải xanh mới được merge.
- Nhánh tính năng tách từ `main`: `feature/<task>-<mô-tả>` (vd. `feature/task9`), sửa lỗi `fix/<mô-tả>`, tài liệu `docs/<mô-tả>`.
- PR ghi rõ: task/issue liên quan, thay đổi gì, cách test; ít nhất 1 thành viên khác review.

### 9.2 Quy ước commit
Theo Conventional Commits: `<loại>(<phạm vi>): <mô tả>` – loại: `feat`, `fix`, `docs`, `test`, `ci`, `chore`, `refactor`.
Ví dụ: `feat(task9): man hinh xac nhan don`, `fix(api): kiem tra CORS`, `ci: them buoc E2E`.

### 9.3 Definition of Done
Một hạng mục chỉ được coi là xong khi:
1. Code đã merge vào `main` qua PR có review, CI xanh (lint, test, build).
2. Có test cho logic mới (unit; integration/E2E nếu đụng API hoặc luồng chính).
3. Đáp ứng tiêu chí chấp nhận của yêu cầu (FR/NFR) tương ứng.
4. Cập nhật tài liệu liên quan: README, `docs/traceability-matrix.md` (mã yêu cầu ↔ code ↔ test), sơ đồ nếu thay đổi thiết kế.
5. Đã deploy và smoke test production đạt (với thay đổi lên `main`).

