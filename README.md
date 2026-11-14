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
│   └── traceability-matrix.md # Ma trận truy vết
├── .github/
│   └── workflows/ci.yml   # CI Pipeline
├── Dockerfile             # Đóng gói toàn bộ monorepo (demo local)
├── docker-compose.yml     # Chạy local: Web + API + PostgreSQL
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

---

## 3. Kiểm thử (Test)

| Lệnh | Nơi chạy | Mô tả |
| --- | --- | --- |
| `npm run lint` | `apps/web` | ESLint cho frontend |
| `npm run test` | root (hoặc `apps/api`) | Unit test API (Jest) — toàn bộ test hiện nằm ở backend |

```bash
npm run test                          # chạy toàn bộ unit test API
npm --prefix apps/web run lint        # lint frontend
```

Kết quả tham chiếu: **66/66 test pass** (7 test suites: auth, orders, payments, products, rbac, jwt-guard, health).

> Ghi chú: Frontend chưa có unit/E2E test tự động — nằm trong kế hoạch Sprint 2 (Task 5.2: integration test cho tạo đơn/thanh toán và 1 E2E test luồng menu → xác nhận đơn).

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
docker build -t brewlite:local .
docker run -p 3000:3000 -p 4000:4000 --env-file .env brewlite:local
```

> Lưu ý: image hiện tại chạy **chế độ dev** (cả Web + API trong một container, dùng cho demo local). Image production riêng cho API trên Render nằm trong checklist mục 6.

---

## 5. Deploy

| Thành phần | Nền tảng | URL |
| --- | --- | --- |
| Web (Next.js) | Vercel | https://phuc-long-omega.vercel.app/ |
| API (NestJS) | Render (Docker) | https://phuclong-kf14.onrender.com/ |
| Health check | Render | https://phuclong-kf14.onrender.com/health |
| PostgreSQL | Neon | — (connection string không public) |

Chi tiết lựa chọn nền tảng: [ADR-004](docs/architecture/adr/004-render-vercel-neon.md).

---

## 6. Checklist cần hoàn thiện trước khi go-live

- [ ] **Dockerfile production cho API**: image hiện tại là dev-mode (`CMD npm run dev` chạy cả Web + API). Cần image chỉ chứa API: build `nest build` rồi `CMD ["node", "dist/main"]`.
- [x] **Endpoint `GET /health`** (theo NFR-04): đã triển khai — trả 200 `{"status":"ok","database":"up"}` khi DB sẵn sàng, 503 khi DB mất. Smoke test: `curl https://phuclong-kf14.onrender.com/health` (cần redeploy API lên Render để có trên production).
- [ ] **CD pipeline** (Task 5.3): quality gate → build image tag theo commit SHA → push registry → deploy → health check → tự rollback khi thất bại.
- [ ] **Secrets** chỉ đặt trong dashboard Render/Vercel/Neon, không commit vào repo, không in ra log CI.

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
