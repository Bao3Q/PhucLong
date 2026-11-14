import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { setupApp } from '../app.setup';

/**
 * E2E (không cần DB — NODE_ENV=test nên PrismaModule cấp null và mọi service
 * chạy nhánh in-memory): kiểm tra phân quyền thêm / sửa sản phẩm và đặt đơn.
 * - Không đăng nhập → 401
 * - CUSTOMER        → 403
 * - ADMIN           → được phép
 */
describe('Auth + phân quyền (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let customerToken: string;

  const newProduct = {
    name: 'Trà Đào Test',
    category: 'Trà Trái Cây',
    basePrice: 39000,
    image: 'https://example.com/tra-dao.jpg',
    stock: 15,
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e_secret';
    process.env.BCRYPT_ROUNDS = '4';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();

    const admin = await request(http)
      .post('/auth/login')
      .send({ email: 'admin@phuclong.vn', password: 'Admin@123456' });
    adminToken = admin.body.accessToken;

    await request(http)
      .post('/auth/register')
      .send({ email: 'khach@phuclong.vn', password: 'matkhau123' })
      .expect(201);
    const customer = await request(http)
      .post('/auth/login')
      .send({ email: 'khach@phuclong.vn', password: 'matkhau123' })
      .expect(200);
    customerToken = customer.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('xem menu (công khai)', () => {
    it('GET /products không cần token', async () => {
      const res = await request(http).get('/products').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
    it('GET /products/1 không cần token', async () => {
      const res = await request(http).get('/products/1').expect(200);
      expect(res.body.id).toBe('1');
    });
  });

  describe('đăng ký / đăng nhập', () => {
    it('đăng ký trùng email → 409', async () => {
      await request(http)
        .post('/auth/register')
        .send({ email: 'KHACH@phuclong.vn', password: 'matkhau123' })
        .expect(409);
    });
    it('mật khẩu quá ngắn → 400', async () => {
      await request(http)
        .post('/auth/register')
        .send({ email: 'a@b.vn', password: '123' })
        .expect(400);
    });
    it('sai mật khẩu → 401', async () => {
      await request(http)
        .post('/auth/login')
        .send({ email: 'khach@phuclong.vn', password: 'sai-mat-khau' })
        .expect(401);
    });
    it('không thể tự đăng ký làm ADMIN', async () => {
      const res = await request(http)
        .post('/auth/register')
        .send({ email: 'hack@phuclong.vn', password: 'matkhau123', role: 'ADMIN' })
        .expect(201);
      expect(res.body.role).toBe('CUSTOMER');
    });
  });

  describe('chưa đăng nhập → 401', () => {
    it('POST /products', async () => {
      await request(http).post('/products').send(newProduct).expect(401);
    });
    it('PATCH /products/1', async () => {
      await request(http).patch('/products/1').send({ name: 'X' }).expect(401);
    });
    it('token giả → 401', async () => {
      await request(http)
        .post('/products')
        .set('Authorization', 'Bearer khong.hop.le')
        .send(newProduct)
        .expect(401);
    });
    it('GET /orders/me chưa đăng nhập → 401', async () => {
      await request(http).get('/orders/me').expect(401);
    });
  });

  describe('CUSTOMER → 403 (không được thêm / sửa)', () => {
    const auth = () => ({ Authorization: `Bearer ${customerToken}` });

    it('POST /products', async () => {
      await request(http)
        .post('/products')
        .set(auth())
        .send(newProduct)
        .expect(403);
    });
    it('PATCH /products/1', async () => {
      await request(http)
        .patch('/products/1')
        .set(auth())
        .send({ name: 'Bị sửa trái phép' })
        .expect(403);
    });
    it('sản phẩm vẫn nguyên vẹn sau các lần bị từ chối', async () => {
      const res = await request(http).get('/products/1').expect(200);
      expect(res.body.name).not.toBe('Bị sửa trái phép');
    });
  });

  describe('ADMIN → được thêm / sửa', () => {
    const auth = () => ({ Authorization: `Bearer ${adminToken}` });
    let createdId: string;

    it('POST /products → 201 (size/topping theo chuẩn quán)', async () => {
      const res = await request(http)
        .post('/products')
        .set(auth())
        .send(newProduct)
        .expect(201);
      createdId = res.body.id;
      expect(res.body).toMatchObject({ name: 'Trà Đào Test', basePrice: 39000, stock: 15 });
      expect(res.body.sizes).toEqual([
        { id: 1, name: 'Size S', price: 0 },
        { id: 2, name: 'Size M (+5k)', price: 5000 },
        { id: 3, name: 'Size L (+10k)', price: 10000 },
      ]);
      await request(http).get(`/products/${createdId}`).expect(200);
    });

    it('POST /products dữ liệu sai → 400', async () => {
      await request(http)
        .post('/products')
        .set(auth())
        .send({ name: '', basePrice: -5 })
        .expect(400);
    });

    it('PATCH /products/:id → 200', async () => {
      const res = await request(http)
        .patch(`/products/${createdId}`)
        .set(auth())
        .send({ basePrice: 42000 })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Trà Đào Test', basePrice: 42000 });
    });

    it('PATCH sản phẩm không tồn tại → 404', async () => {
      await request(http)
        .patch('/products/999999')
        .set(auth())
        .send({ name: 'X' })
        .expect(404);
    });
  });

  describe('guard bảo vệ route đặt đơn + giá tính trên server', () => {
    const order = {
      items: [
        {
          productId: '1',
          size: 'M',
          qty: 1,
        },
      ],
    };

    it('POST /orders không có token → 401', async () => {
      await request(http).post('/orders').send(order).expect(401);
    });
    it('POST /orders token giả → 401', async () => {
      await request(http)
        .post('/orders')
        .set('Authorization', 'Bearer khong.hop.le')
        .send(order)
        .expect(401);
    });
    it('POST /orders có token khách hàng → 201, giá server tính (45000 + size M 5000)', async () => {
      const res = await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(order)
        .expect(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.total).toBe(50000);
      expect(res.body.items[0]).toMatchObject({
        productId: '1',
        productName: 'Cappuccino Espresso',
        unitPrice: 50000,
        lineTotal: 50000,
      });
      // GET /orders/me thấy đơn vừa tạo
      const mine = await request(http)
        .get('/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(mine.body.some((o: { id: number }) => o.id === res.body.id)).toBe(true);
    });
    it('POST /orders payload sai (thiếu qty) → 400', async () => {
      await request(http)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ items: [{ productId: '1', size: 'M' }] })
        .expect(400);
    });
  });
});
