// Prisma CLI config (hỗ trợ cả Prisma 6.16+ và Prisma 7)
// Prisma 7 đã bỏ `url` khỏi datasource trong schema.prisma —
// URL kết nối giờ nằm ở đây.
import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // Generate does not connect to the database; migration commands must use
    // an explicitly configured DATABASE_URL instead of silently targeting a default.
    url: process.env.DATABASE_URL ?? '',
  },
});