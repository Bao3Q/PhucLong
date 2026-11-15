/**
 * Integration test (Task 5.2) – luồng tạo đơn → thanh toán qua HTTP thật trên
 * toàn bộ AppModule + PostgreSQL thật (transaction, trừ kho, idempotency).
 * Mã test khớp docs/traceability-matrix.md (INT-T01 … INT-T07).
 */
import { INestApplication } from '@nestjs/common';
import { ONE_CAPPUCCINO, PASSWORD, bearer, createApp, registerAndLogin, request, uniqueEmail } from './helpers';

type Cup = { size: string; quantity: number };

describe('API tạo đơn và thanh toán (integration, PostgreSQL thật)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await createApp();
    http = app.getHttpServer();
    tokenA = await registerAndLogin(app, 'khach-a');
    tokenB = await registerAndLogin(app, 'khach-b');
  });

  afterAll(async () => {
    await app?.close();
  });

  async function cupsS(): Promise<number> {
    const res = await request(http).get('/inventory').expect(200);
    return (res.body.cups as Cup[]).find((c) => c.size === 'S')?.quantity ?? -1;
  }

  async function createOrder(token: string) {
    const res = await request(http).post('/orders').set(bearer(token)).send(ONE_CAPPUCCINO).expect(201);
    return res.body as { id: number; status: string; total: number; items: { unitPrice: number; qty: number }[] };
  }

  it('INT-T01 GET /health → 200, database up', async () => {
    const res = await request(http).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('INT-T02 GET /products trả menu từ database', async () => {
    const res = await request(http).get('/products').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((p: { id: string }) => p.id)).toContain('1');
  });

  it('INT-T03 đăng ký trùng email → 409, sai mật khẩu → 401', async () => {
    const email = uniqueEmail('trung');
    await request(http).post('/auth/register').send({ email, password: PASSWORD }).expect(201);
    await request(http).post('/auth/register').send({ email, password: PASSWORD }).expect(409);
    await request(http).post('/auth/login').send({ email, password: 'SaiMatKhau123' }).expect(401);
  });

  it('INT-T04 POST /orders: không JWT → 401, dữ liệu sai → 400, hợp lệ → 201 PENDING với giá do server tính', async () => {
    await request(http).post('/orders').send(ONE_CAPPUCCINO).expect(401);
    await request(http)
      .post('/orders')
      .set(bearer(tokenA))
      .send({ items: [{ productId: '1', size: 'XL', qty: 0 }] })
      .expect(400);

    const order = await createOrder(tokenA);
    expect(order.status).toBe('PENDING');
    expect(order.total).toBeGreaterThan(0);
    expect(order.total).toBe(order.items[0].unitPrice * order.items[0].qty);
  });

  it('INT-T05 POST /payments thành công → PAID, trừ ly trong cùng transaction', async () => {
    const order = await createOrder(tokenA);
    const before = await cupsS();

    const pay = await request(http)
      .post('/payments')
      .set(bearer(tokenA))
      .set('Idempotency-Key', `it-pay-${order.id}`)
      .send({ orderId: String(order.id), method: 'momo' })
      .expect(201);
    expect(pay.body).toMatchObject({ orderId: order.id, status: 'PAID' });
    expect(pay.body.transactionId).toMatch(/^TXN-MOMO-/);

    expect(await cupsS()).toBe(before - 1);
    const detail = await request(http).get(`/orders/${order.id}`).set(bearer(tokenA)).expect(200);
    expect(detail.body.status).toBe('PAID');
  });

  it('INT-T06 idempotency: gửi lại cùng Idempotency-Key → trả lại kết quả cũ, không trừ kho lần hai', async () => {
    const order = await createOrder(tokenA);
    const key = `it-retry-${order.id}`;
    const send = (method: 'momo' | 'card') =>
      request(http)
        .post('/payments')
        .set(bearer(tokenA))
        .set('Idempotency-Key', key)
        .send({ orderId: String(order.id), method });

    const first = await send('momo').expect(201);
    const afterFirst = await cupsS();

    const replay = await send('momo').expect(201);
    expect(replay.body.transactionId).toBe(first.body.transactionId);
    expect(replay.body.id).toBe(first.body.id);
    expect(await cupsS()).toBe(afterFirst);

    // Cùng key nhưng khác nội dung (đổi phương thức) → bị từ chối
    await send('card').expect(400);
    // Key mới cho đơn đã PAID → 400 "đã được thanh toán"
    await request(http)
      .post('/payments')
      .set(bearer(tokenA))
      .set('Idempotency-Key', `${key}-moi`)
      .send({ orderId: String(order.id), method: 'momo' })
      .expect(400);
  });

  it('INT-T07 phân quyền: người khác không xem/thanh toán được đơn, lịch sử chỉ có đơn của mình', async () => {
    const order = await createOrder(tokenA);

    await request(http).get(`/orders/${order.id}`).set(bearer(tokenB)).expect(403);
    await request(http)
      .post('/payments')
      .set(bearer(tokenB))
      .set('Idempotency-Key', `it-stranger-${order.id}`)
      .send({ orderId: String(order.id), method: 'card' })
      .expect(403);

    const mineA = await request(http).get('/orders/me').set(bearer(tokenA)).expect(200);
    expect(mineA.body.map((o: { id: number }) => o.id)).toContain(order.id);
    const mineB = await request(http).get('/orders/me').set(bearer(tokenB)).expect(200);
    expect(mineB.body.map((o: { id: number }) => o.id)).not.toContain(order.id);
  });
});
