import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

// Đọc .env khi chạy local (JWT_SECRET cần cho đăng nhập). Thử apps/api/.env
// rồi tới .env ở thư mục gốc monorepo; biến đã có sẵn không bị ghi đè.
for (const file of ['.env', '../../.env']) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  // CORS whitelist: chỉ những origin trong CORS_ORIGIN (phân cách bằng dấu phẩy)
  // được gọi API — không còn `origin: true` phản chiếu mọi nguồn.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`BrewLite NestJS API is running on: http://localhost:${port}`);
}
void bootstrap();
