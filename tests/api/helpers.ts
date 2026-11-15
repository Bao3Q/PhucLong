import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../apps/api/src/app.module';
import { setupApp } from '../../apps/api/src/app.setup';

/**
 * supertest là CommonJS; tuỳ phiên bản @types/supertest mà kiểu là `export =`
 * hay default export. Lấy hàm qua require để chạy đúng ở mọi phiên bản.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const supertestModule: any = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const request: (app: any) => any = supertestModule.default ?? supertestModule;

/** Dựng toàn bộ API giống main.ts (ValidationPipe toàn cục) nhưng không mở cổng mạng. */
export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}

/** Email không trùng giữa các lần chạy (DB của CI/local có thể còn dữ liệu cũ). */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@it.phuclong.vn`;
}

export const PASSWORD = 'Password123!';

/** Đăng ký + đăng nhập, trả về access token. */
export async function registerAndLogin(app: INestApplication, prefix: string): Promise<string> {
  const email = uniqueEmail(prefix);
  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: PASSWORD })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return login.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Một món Cappuccino (id '1') size S — sản phẩm, ly và công thức có sẵn từ migration seed. */
export const ONE_CAPPUCCINO = { items: [{ productId: '1', size: 'S', qty: 1, toppings: [] }] };
