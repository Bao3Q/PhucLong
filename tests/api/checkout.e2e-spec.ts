/**
 * Integration test (Task 5.2) – luồng tạo đơn → thanh toán qua HTTP thật trên
 * toàn bộ AppModule + PostgreSQL thật (transaction, trừ kho, idempotency).
 * Mã test khớp docs/traceability-matrix.md (INT-T01 … INT-T08).
 */
import { INestApplication } from '@nestjs/common';
import { OrdersService } from '../../apps/api/src/orders/orders.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { ONE_CAPPUCCINO, PASSWORD, bearer, createApp, loginAdmin, registerAndLogin, request, uniqueEmail } from './helpers';

type Cup = { size: string; quantity: number };

const SEPAY_ENV = {
  SEPAY_BANK_CODE: 'MB',
  SEPAY_ACCOUNT_NUMBER: '1234567890',
  SEPAY_ACCOUNT_NAME: 'PHUC LONG TEST',
  SEPAY_API_KEY: 'it-sepay-key',
};

describe('API tạo đơn và thanh toán (integration, PostgreSQL thật)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let tokenA: string;
  let tokenB: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    Object.assign(process.env, SEPAY_ENV);
    app = await createApp();
    http = app.getHttpServer();
    tokenA = await registerAndLogin(app, 'khach-a');
    tokenB = await registerAndLogin(app, 'khach-b');
    tokenAdmin = await loginAdmin(app);
  });

  afterAll(async () => {
    for (const key of Object.keys(SEPAY_ENV)) delete process.env[key];
    await app?.close();
  });

  async function cupsS(): Promise<number> {
    // GET /inventory giờ chỉ ADMIN được xem → dùng token admin
    const res = await request(http).get('/inventory').set(bearer(tokenAdmin)).expect(200);
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

  /** SePay: mở phiên, gửi webhook như SePay (khóa API + payload giao dịch tiền vào). */
  function sepay(token: string, orderId: number) {
    const checkout = (restart?: boolean) =>
      request(http).post('/payments/sepay/checkout').set(bearer(token)).send({ orderId, restart });
    const webhook = (body: Record<string, unknown>) =>
      request(http)
        .post('/payments/sepay/webhook')
        .set('Authorization', `Apikey ${SEPAY_ENV.SEPAY_API_KEY}`)
        .send({
          id: Date.now(),
          accountNumber: SEPAY_ENV.SEPAY_ACCOUNT_NUMBER,
          transferType: 'in',
          content: `PHUCLONG-${orderId}`,
          ...body,
        });
    return { checkout, webhook };
  }
  const orderStatus = async (token: string, id: number) =>
    (await request(http).get(`/orders/${id}`).set(bearer(token)).expect(200)).body.status;

  it('INT-T08 SePay: checkout → webhook đối soát nghiêm ngặt → PAID, trừ ly một lần, webhook trùng an toàn', async () => {
    const order = await createOrder(tokenA);
    const before = await cupsS();
    const { checkout, webhook } = sepay(tokenA, order.id);
    const txId = Date.now();

    // Người khác không mở được phiên của đơn này
    await sepay(tokenB, order.id).checkout().expect(404);

    const opened = await checkout().expect(201);
    expect(opened.body).toMatchObject({
      orderId: order.id,
      amount: order.total,
      status: 'PENDING',
      transferDescription: `PHUCLONG-${order.id}`,
    });
    // Gọi lại khi còn hạn → đúng phiên cũ (F5 trang QR không đổi mã)
    expect((await checkout().expect(201)).body.expiresAt).toBe(opened.body.expiresAt);

    // Không khóa API → 401; sai số tiền (thiếu/dư), sai tài khoản, sai nội dung → 400, đơn giữ nguyên
    await request(http).post('/payments/sepay/webhook').send({ id: txId }).expect(401);
    await webhook({ id: txId, transferAmount: order.total - 1 }).expect(400);
    await webhook({ id: txId, transferAmount: order.total + 1 }).expect(400);
    await webhook({ id: txId, transferAmount: order.total, accountNumber: '999' }).expect(400);
    await webhook({ id: txId, transferAmount: order.total, content: 'ck tien' }).expect(400);
    expect(await orderStatus(tokenA, order.id)).toBe('PENDING');

    await webhook({ id: txId, transferAmount: order.total }).expect(200, { success: true });
    expect(await orderStatus(tokenA, order.id)).toBe('PAID');
    expect(await cupsS()).toBe(before - 1);

    // Webhook trùng → 200 và không trừ kho lần hai; giao dịch khác cho đơn đã trả → 409
    await webhook({ id: txId, transferAmount: order.total }).expect(200);
    expect(await cupsS()).toBe(before - 1);
    await webhook({ id: txId + 1, transferAmount: order.total }).expect(409);
    await checkout().expect(409);
  });

  it('INT-T08b SePay: phiên hết hạn → webhook 409, checkout báo EXPIRED (đơn PAYMENT_FAILED), thanh toán lại → PAID', async () => {
    const order = await createOrder(tokenA);
    const { checkout, webhook } = sepay(tokenA, order.id);
    await checkout().expect(201);

    // Ép phiên hết hạn (thay vì chờ 2 phút)
    await app
      .get(PrismaService)
      .payment.updateMany({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await webhook({ transferAmount: order.total }).expect(409);
    expect(await orderStatus(tokenA, order.id)).toBe('PENDING');

    expect((await checkout().expect(201)).body.status).toBe('EXPIRED');
    expect(await orderStatus(tokenA, order.id)).toBe('PAYMENT_FAILED');

    expect((await checkout(true).expect(201)).body.status).toBe('PENDING');
    await webhook({ transferAmount: order.total }).expect(200);
    expect(await orderStatus(tokenA, order.id)).toBe('PAID');
  });

  it('INT-T09 hủy đơn đã trả tiền hoàn kho và trừ điểm đúng một lần', async () => {
    const db = app.get(PrismaService);
    const productId = ONE_CAPPUCCINO.items[0].productId;
    const recipes = await db.recipeItem.findMany({
      where: { productId, size: 'S' },
      include: { ingredient: true },
    });
    expect(recipes.length).toBeGreaterThan(0);
    const stock = async () => (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;
    const points = async () =>
      (await request(http).get('/payments/loyalty').set(bearer(tokenA)).expect(200)).body.loyaltyPoints;
    const original = { stock: await stock(), cups: await cupsS(), points: await points() };
    const order = await createOrder(tokenA);
    await request(http).post('/payments').set(bearer(tokenA))
      .set('Idempotency-Key', `it-refund-${order.id}`)
      .send({ orderId: order.id, method: 'card' }).expect(201);
    expect(await points()).toBe(original.points + Math.floor(order.total / 10000));

    const cancel = () => request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(tokenAdmin)).send({ status: 'CANCELLED' });
    await request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(tokenA)).send({ status: 'CANCELLED' }).expect(403);
    const [recipe] = recipes;
    await db.recipeItem.update({ where: { id: recipe.id }, data: { amount: recipe.amount.mul(2) } });
    const attempts = await Promise.all([cancel(), cancel()]).finally(() =>
      db.recipeItem.update({ where: { id: recipe.id }, data: { amount: recipe.amount } }),
    );
    expect(attempts.filter((response) => response.status === 200)).toHaveLength(1);
    expect(await orderStatus(tokenA, order.id)).toBe('CANCELLED');
    expect({ stock: await stock(), cups: await cupsS(), points: await points() }).toEqual(original);
    for (const { ingredient } of recipes) {
      const restored = await db.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
      expect(restored.quantity.toString()).toBe(ingredient.quantity.toString());
    }
    expect(await db.loyaltyTransaction.findMany({
      where: { orderId: order.id, type: 'ADJUST' },
      select: { points: true, balanceAfter: true },
    })).toEqual([{ points: -Math.floor(order.total / 10000), balanceAfter: original.points }]);
    expect(await db.payment.findFirst({ where: { orderId: order.id } }))
      .toMatchObject({ status: 'REFUNDED' });
  });

  it('INT-T10 hủy đơn chưa trả tiền đóng phiên QR và giữ nguyên điểm', async () => {
    const order = await createOrder(tokenA);
    await sepay(tokenA, order.id).checkout().expect(201);
    const db = app.get(PrismaService);
    await request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(tokenA)).send({ status: 'CANCELLED' }).expect(200);
    expect(await db.payment.findFirst({ where: { orderId: order.id } }))
      .toMatchObject({ status: 'EXPIRED' });
    expect(await db.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('INT-T11 hủy đơn SePay đã trả tiền tạo trạng thái chờ hoàn tiền', async () => {
    const order = await createOrder(tokenA);
    const { checkout, webhook } = sepay(tokenA, order.id);
    await checkout().expect(201);
    const event = { id: Date.now(), transferAmount: order.total };
    await webhook(event).expect(200);
    await request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(tokenAdmin)).send({ status: 'CANCELLED' }).expect(200);
    const payment = await app.get(PrismaService).payment.findFirstOrThrow({ where: { orderId: order.id } });
    expect(payment).toMatchObject({ status: 'REFUND_PENDING' });
    await webhook(event).expect(200);
    const queue = () => request(http).get('/payments/refunds').set(bearer(tokenAdmin)).expect(200);
    expect((await queue()).body).toContainEqual(expect.objectContaining({ id: payment.id }));
    await request(http).get('/payments/refunds').set(bearer(tokenA)).expect(403);

    const confirm = (reference: string) => request(http).patch(`/payments/${payment.id}/refund`)
      .set(bearer(tokenAdmin)).send({ reference });
    const reference = `BANK-REFUND-${order.id}`;
    await request(http).patch(`/payments/${payment.id}/refund`)
      .set(bearer(tokenA)).send({ reference }).expect(403);
    await confirm(reference).expect(200, { id: payment.id, status: 'REFUNDED', reference });
    await confirm(reference).expect(200);
    await webhook(event).expect(200);
    expect(await orderStatus(tokenA, order.id)).toBe('CANCELLED');
    await confirm('OTHER-REFERENCE').expect(409);
    expect((await queue()).body).not.toContainEqual(expect.objectContaining({ id: payment.id }));
  });

  it('INT-T12 tự hủy chỉ đóng QR quá hạn và giữ đơn có QR còn hiệu lực', async () => {
    const db = app.get(PrismaService);
    const order = await createOrder(tokenA);
    const cutoff = new Date(Date.now() - 60000);
    await db.order.update({
      where: { id: order.id },
      data: { createdAt: new Date(cutoff.getTime() - 60000) },
    });
    await sepay(tokenA, order.id).checkout().expect(201);
    const orders = app.get(OrdersService);
    await orders.cancelExpiredOrder(order.id, cutoff);
    expect(await orderStatus(tokenA, order.id)).toBe('PENDING');
    await db.payment.updateMany({
      where: { orderId: order.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await orders.cancelExpiredOrder(order.id, cutoff);
    expect(await orderStatus(tokenA, order.id)).toBe('CANCELLED');
    expect(await db.payment.findFirst({ where: { orderId: order.id } }))
      .toMatchObject({ status: 'EXPIRED' });
  });

  it('INT-T13 chỉ một đơn giữ được lượt voucher cuối', async () => {
    const db = app.get(PrismaService);
    const { code } = await db.promotion.create({
      data: {
        code: `INT-LAST-${Date.now()}`,
        name: 'Voucher test',
        discountType: 'FIXED',
        discountValue: 1000,
        usageLimit: 1,
      },
    });
    const checkout = (token: string, productId: string) => request(http).post('/orders').set(bearer(token))
      .send({ items: [{ productId, size: 'S', qty: 1 }], voucherCode: code });
    const results = await Promise.all([checkout(tokenA, '1'), checkout(tokenB, '2')]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 400]);
    expect(await db.promotion.findUnique({ where: { code } })).toMatchObject({ usedCount: 1 });
    expect(await db.order.count({ where: { voucherCode: code } })).toBe(1);
  });

  it('mỗi tài khoản dùng mỗi mã một lần và vẫn dùng được mã khác', async () => {
    const db = app.get(PrismaService);
    const firstAccount = await registerAndLogin(app, 'voucher-a');
    const otherAccount = await registerAndLogin(app, 'voucher-b');
    const redemption = (token: string) => request(http).get('/promotions/redemption').set(bearer(token));
    await request(http).get('/promotions/redemption').expect(401);
    expect((await redemption(firstAccount).expect(200)).body).toEqual({ usedCodes: [] });
    const stamp = Date.now();
    const codes = [`INT-ONCE-A-${stamp}`, `INT-ONCE-B-${stamp}`];
    await db.promotion.createMany({
      data: codes.map((code) => ({
        code,
        name: 'Voucher dùng một lần',
        discountType: 'FIXED',
        discountValue: 1000,
        usageLimit: 20,
      })),
    });
    const preview = (token: string, code: string) => request(http).post('/promotions/validate').set(bearer(token))
      .send({ code: code.toLowerCase(), subtotal: 50000 });
    const checkout = (token: string, productId: string, code: string) => request(http).post('/orders').set(bearer(token))
      .send({ items: [{ productId, size: 'S', qty: 1 }], voucherCode: code });

    await preview(firstAccount, codes[0]).expect(201);
    await preview(firstAccount, codes[1]).expect(201);
    const attempts = await Promise.all([
      checkout(firstAccount, '1', codes[0]),
      checkout(firstAccount, '2', codes[0].toLowerCase()),
    ]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 400]);
    const duplicateMessage = `Bạn đã sử dụng mã "${codes[0]}".`;
    expect(attempts.find(({ status }) => status === 400)?.body.message).toBe(duplicateMessage);
    expect((await preview(firstAccount, codes[0]).expect(400)).body.message).toBe(duplicateMessage);
    expect((await redemption(firstAccount).expect(200)).body).toEqual({ usedCodes: [codes[0]] });
    expect((await redemption(otherAccount).expect(200)).body).toEqual({ usedCodes: [] });

    const orderId = attempts.find(({ status }) => status === 201)!.body.id as number;
    await request(http).patch(`/orders/${orderId}/status`).set(bearer(firstAccount))
      .send({ status: 'CANCELLED' }).expect(200);
    await checkout(firstAccount, '1', codes[0]).expect(400);
    await createOrder(firstAccount);
    await preview(firstAccount, codes[1]).expect(201);
    await checkout(firstAccount, '2', codes[1]).expect(201);
    await preview(firstAccount, codes[1]).expect(400);
    expect((await redemption(firstAccount).expect(200)).body.usedCodes.sort()).toEqual(codes);
    await preview(otherAccount, codes[0]).expect(201);
    await checkout(otherAccount, '1', codes[0]).expect(201);
    await preview(otherAccount, codes[0]).expect(400);
    const promos = await db.promotion.findMany({ where: { code: { in: codes } } });
    expect(promos.map(({ usedCount }) => usedCount).sort()).toEqual([1, 2]);
    expect(await db.order.count({ where: { voucherCode: { in: codes } } })).toBe(3);
  });

  it('INT-T14 endpoint thanh toán từ chối dữ liệu sai kiểu', async () => {
    const order = await createOrder(tokenA);
    await request(http).post('/payments').set(bearer(tokenA))
      .send({ orderId: order.id, method: 42 }).expect(400);
    await request(http).post('/payments').set(bearer(tokenA))
      .send({ orderId: 'invalid', method: 'card' }).expect(400);
    expect(await orderStatus(tokenA, order.id)).toBe('PENDING');
  });

  it('INT-T15 hết ly rollback trạng thái thanh toán và mọi thay đổi liên quan', async () => {
    const db = app.get(PrismaService);
    const order = await createOrder(tokenA);
    const cup = await db.cup.findUniqueOrThrow({ where: { size: 'S' } });
    await db.cup.update({ where: { size: 'S' }, data: { quantity: 0 } });
    try {
      await request(http).post('/payments').set(bearer(tokenA))
        .send({ orderId: order.id, method: 'card' }).expect(400);
      expect(await orderStatus(tokenA, order.id)).toBe('PENDING');
      expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
      expect(await db.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(0);
    } finally {
      await db.cup.update({ where: { size: 'S' }, data: { quantity: cup.quantity } });
    }
  });

  it('INT-T16 hủy thanh toán cũ thiếu dữ liệu kho tạo cờ đối soát', async () => {
    const db = app.get(PrismaService);
    const order = await createOrder(tokenA);
    const cupsBefore = await cupsS();
    const paid = await request(http).post('/payments').set(bearer(tokenA))
      .send({ orderId: order.id, method: 'card' }).expect(201);
    await db.payment.update({
      where: { id: paid.body.id },
      data: { result: { transactionId: paid.body.transactionId, status: 'SUCCEEDED' } },
    });
    await request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(tokenAdmin)).send({ status: 'CANCELLED' }).expect(200);
    expect(await cupsS()).toBe(cupsBefore - 1);
    expect(await db.payment.findUnique({ where: { id: paid.body.id } }))
      .toMatchObject({ status: 'REFUNDED', result: { inventoryReconciliationRequired: true } });
  });

  it('INT-T17 chỉ luồng thanh toán ghi PAID; ADMIN cập nhật tiến độ sau khi trả tiền', async () => {
    const order = await createOrder(tokenA);
    const update = (token: string, status: string) => request(http).patch(`/orders/${order.id}/status`)
      .set(bearer(token)).send({ status });
    await update(tokenA, 'PAID').expect(403);
    await update(tokenAdmin, 'PAID').expect(403);
    await update(tokenB, 'CANCELLED').expect(403);
    expect(await orderStatus(tokenA, order.id)).toBe('PENDING');

    await request(http).post('/payments').set(bearer(tokenA))
      .send({ orderId: order.id, method: 'card' }).expect(201);
    await update(tokenA, 'PREPARING').expect(403);
    await update(tokenAdmin, 'READY').expect(400);
    await update(tokenAdmin, 'PREPARING').expect(200);
    await update(tokenAdmin, 'CANCELLED').expect(400);
    await update(tokenAdmin, 'READY').expect(200);
    await update(tokenAdmin, 'COMPLETED').expect(200);
  });

  it('INT-T18 hai lần thanh toán cùng khóa chỉ trừ kho và cộng điểm một lần', async () => {
    const db = app.get(PrismaService);
    const order = await createOrder(tokenA);
    const cupsBefore = await cupsS();
    const send = () => request(http).post('/payments').set(bearer(tokenA))
      .set('Idempotency-Key', `concurrent-${order.id}`)
      .send({ orderId: order.id, method: 'card' });
    const [first, second] = await Promise.all([send().expect(201), send().expect(201)]);
    expect(first.body.id).toBe(second.body.id);
    expect(await cupsS()).toBe(cupsBefore - 1);
    expect(await db.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN' } })).toBe(1);
  });
});
