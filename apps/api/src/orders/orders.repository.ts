import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import {
  Order,
  OrderItem,
  OrderStatus,
  ProductSize,
} from './entities/order.entity';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Kho đơn hàng: đi qua Prisma/PostgreSQL khi có kết nối, tự chuyển sang
 * Map trong bộ nhớ khi không có PrismaService (unit test — prisma là null).
 */
@Injectable()
export class OrdersRepository {
  private readonly orders = new Map<number, Order>();
  private nextOrderId = 1001;
  private nextItemId = 1;

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  /** Cấp mã đơn mới (hiển thị dạng #1001, #1002, ...). */
  nextId(): number {
    return this.nextOrderId++;
  }

  /** Cấp id cho dòng sản phẩm trong đơn. */
  nextItemIdValue(): number {
    return this.nextItemId++;
  }

  /** Lưu giữ trạng thái kỳ vọng — CAS cho nhánh in-memory (Prisma dùng updateMany riêng). */
  async saveStatus(order: Order, expectedStatus: OrderStatus): Promise<Order> {
    if (!this.prisma && this.orders.get(order.id)?.status !== expectedStatus) {
      throw new ConflictException('Trạng thái đơn hàng vừa được thay đổi, vui lòng thử lại');
    }
    return this.save(order);
  }

  async save(order: Order): Promise<Order> {
    if (this.prisma) {
      const data = {
        userId: order.userId,
        status: order.status,
        subtotal: order.subtotal ?? order.total,
        discountAmount: order.discountAmount ?? 0,
        voucherCode: order.voucherCode ?? null,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
      const saved = await this.prisma.order.upsert({
        where: { id: order.id },
        create: {
          id: order.id,
          ...data,
          items: {
            create: order.items.map(
              ({ id: _id, orderId: _orderId, ...item }) => item,
            ),
          },
        },
        update: data,
        include: { items: true },
      });
      return this.fromPrisma(saved);
    }
    const copy = this.clone(order);
    this.orders.set(copy.id, copy);
    if (copy.id >= this.nextOrderId) this.nextOrderId = copy.id + 1;
    for (const item of copy.items) {
      if (item.id >= this.nextItemId) this.nextItemId = item.id + 1;
    }
    return this.clone(copy);
  }

  async create(
    order: Omit<Order, 'id' | 'items'> & {
      items: Array<Omit<OrderItem, 'id' | 'orderId'>>;
    },
  ): Promise<Order> {
    if (this.prisma) {
      const created = await this.prisma.order.create({
        data: {
          userId: order.userId,
          status: order.status,
          subtotal: order.subtotal ?? order.total,
          discountAmount: order.discountAmount ?? 0,
          voucherCode: order.voucherCode ?? null,
          total: order.total,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: { create: order.items },
        },
        include: { items: true },
      });
      return this.fromPrisma(created);
    }

    const id = this.nextId();
    const created: Order = {
      ...order,
      id,
      items: order.items.map((item) => ({
        ...item,
        id: this.nextItemIdValue(),
        orderId: id,
      })),
    };
    return this.save(created);
  }

  async findById(id: number): Promise<Order | undefined> {
    if (this.prisma) {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });
      return order ? this.fromPrisma(order) : undefined;
    }
    const order = this.orders.get(id);
    return order ? this.clone(order) : undefined;
  }

  /** Lấy toàn bộ đơn của một user, mới nhất trước. */
  async findByUserId(userId: string): Promise<Order[]> {
    if (this.prisma) {
      const orders = await this.prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return orders.map((order) => this.fromPrisma(order));
    }
    return [...this.orders.values()]
      .filter((o) => o.userId === userId)
      .sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
      )
      .map((o) => this.clone(o));
  }

  /** Dùng trong test. */
  clear(): void {
    this.orders.clear();
    this.nextOrderId = 1001;
    this.nextItemId = 1;
  }

  private clone(order: Order): Order {
    return {
      ...order,
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt),
      items: order.items.map((i) => ({
        ...i,
        toppings: [...i.toppings],
        note: i.note ? String(i.note) : undefined,
      })),
    };
  }

  /** Map row PostgreSQL → entity Order (cần public để service dùng trong transaction). */
  fromPrisma(order: {
    id: number;
    userId: string;
    status: string;
    subtotal: number;
    discountAmount: number;
    voucherCode: string | null;
    total: number;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: number;
      orderId: number;
      productId: string;
      productName: string;
      size: string;
      toppings: string[];
      note: string | null;
      qty: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }): Order {
    return {
      ...order,
      status: order.status as OrderStatus,
      voucherCode: order.voucherCode ?? undefined,
      items: order.items.map((item) => ({
        ...item,
        size: item.size as ProductSize,
        note: item.note ?? undefined,
      })),
    };
  }
}
