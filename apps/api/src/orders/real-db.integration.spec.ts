import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { ProductsService } from '../products/products.service';
import { PromotionsService } from '../promotions/promotions.service';
import { OrderStatus } from './entities/order.entity';
import { OrderSize } from './dto/create-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth/auth-user.interface';

/**
 * Integration test chạy trên PostgreSQL thật — CHỈ bật khi DATABASE_URL được
 * đặt (CI có service container postgres; chạy local không có DB thì tự skip
 * và toàn bộ unit test in-memory vẫn phủ logic). Đây là nơi transaction SQL
 * thật (optimistic lock, hoàn stock, voucher) được kiểm chứng.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDatabase ? describe : describe.skip;

describeIfDb('OrdersService trên PostgreSQL thật (integration)', () => {
  let prisma: PrismaService;
  let products: ProductsService;
  let orders: OrdersService;
  const adminUser: AuthUser = { id: '00000000-0000-4000-8000-000000000001', role: 'ADMIN' };
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    products = new ProductsService(prisma);
    await products.onModuleInit(); // upsert 4 sản phẩm seed
    orders = new OrdersService(
      new OrdersRepository(prisma),
      products,
      prisma,
      new PromotionsService(prisma),
    );
  });

  afterAll(async () => {
    // Dọn đơn test (OrderItem cascade theo Order)
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    await prisma.$disconnect();
  });

  it('createOrder trừ tồn kho + tăng version trong 1 transaction', async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: '1' } });
    const order = await orders.createOrder(adminUser, {
      items: [{ productId: '1', size: OrderSize.M, qty: 1 }],
    });
    createdOrderIds.push(order.id);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: '1' } });
    expect(after.stock).toBe(before.stock - 1);
    expect(after.version).toBe(before.version + 1);
  });

  it('voucher WELCOME10 giảm 10% (max 20k) và lưu discountAmount + voucherCode', async () => {
    const order = await orders.createOrder(adminUser, {
      items: [{ productId: '1', size: OrderSize.S, qty: 2 }], // subtotal 90.000đ ≥ min 50.000đ
      voucherCode: 'welcome10', // chữ thường — server tự chuẩn hóa
    });
    createdOrderIds.push(order.id);

    expect(order.subtotal).toBe(90000);
    expect(order.discountAmount).toBe(9000);
    expect(order.total).toBe(81000);
    expect(order.voucherCode).toBe('WELCOME10');

    const promo = await prisma.promotion.findUniqueOrThrow({ where: { code: 'WELCOME10' } });
    expect(promo.usedCount).toBeGreaterThan(0);
  });

  it('voucher dưới mức đơn tối thiểu → 400, không tạo đơn', async () => {
    await expect(
      orders.createOrder(adminUser, {
        items: [{ productId: '1', size: OrderSize.S, qty: 1 }], // 45.000đ < min 50.000đ
        voucherCode: 'WELCOME10',
      }),
    ).rejects.toThrow(/50\.000/);
  });

  it('hủy đơn hoàn lại tồn kho (CANCELLED) và version tăng 2 lần', async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: '2' } });
    const order = await orders.createOrder(adminUser, {
      items: [{ productId: '2', size: OrderSize.S, qty: 2 }],
    });
    createdOrderIds.push(order.id);

    await orders.updateOrderStatus(adminUser, order.id, OrderStatus.CANCELLED);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: '2' } });
    expect(after.stock).toBe(before.stock); // trừ 2 rồi hoàn 2
    expect(after.version).toBe(before.version + 2); // +1 khi trừ, +1 khi hoàn
  });
});
