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
├── .env.example           # Biến môi trường mẫu
└── README.md
```

## 2. Quy ước phát triển (Workflow & Git Guidelines)

### 2.1 Chiến lược phân nhánh (Branching Strategy)
- `main`: Nhánh production/release ổn định.
- `develop`: Nhánh tích hợp chính.
- `feat/<sprint>-<feature-name>`: Nhánh tính năng mới (ví dụ: `feat/sprint1-menu-api`, `feat/sprint1-menu-ui`).
- `fix/<issue-name>`: Nhánh sửa lỗi.

Mọi tính năng đều phải tạo **Pull Request (PR)** vào `main` / `develop`, vượt qua pipeline CI (Install -> Lint -> Unit Test -> Build) mới được merge.

### 2.2 Quy ước Commit (Conventional Commits)
Format: `<type>(<scope>): <subject>`
- `feat`: Tính năng mới (ví dụ: `feat(api): add GET /products endpoint`)
- `fix`: Sửa lỗi (ví dụ: `fix(web): handle empty state in product list`)
- `docs`: Tài liệu (ví dụ: `docs: update traceability matrix`)
- `test`: Thêm hoặc cập nhật unit/e2e test
- `chore`: Cấu hình, cài đặt dependencies, CI/CD

### 2.3 Definition of Done (DoD)
Một task/User Story được coi là hoàn thành (Done) khi:
1. Mã nguồn tuân thủ coding conventions và linting không có lỗi.
2. Có đầy đủ unit tests cho các hàm xử lý nghiệp vụ, tỷ lệ pass 100%.
3. Đã cập nhật vào `docs/traceability-matrix.md`.
4. Pull Request được tạo, pipeline CI pass hoàn toàn.

---

## 3. Hướng dẫn chạy môi trường Local

### 3.1 Cài đặt
Copy file cấu hình môi trường:
```bash
cp .env.example .env
```

### 3.2 Khởi chạy Backend (NestJS)
```bash
cd apps/api
npm install
npm run start:dev
```
API chạy tại: `http://localhost:4000`

### 3.3 Khởi chạy Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```
Giao diện Web truy cập tại: `http://localhost:3000`

---

## 4. Kiểm thử (Testing) & CI/CD
- **Lint**: `npm run lint` ở cả `apps/web` và `apps/api`.
- **Test**: `npm run test` để chạy các unit test.
- **Build**: `npm run build` để kiểm tra biên dịch production.
