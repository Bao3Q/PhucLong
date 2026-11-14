import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ProductSize, UserRole } from '../generated/prisma/client';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { Order, OrderItem } from './orders.data';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(user: AuthUser, items: OrderItem[]): Promise<Order> {
    if (items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất một sản phẩm');
    }

    for (const item of items) {
      if (
        !Number.isInteger(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isInteger(item.unitPrice) ||
        item.unitPrice < 0 ||
        !['S', 'M', 'L'].includes(item.size)
      ) {
        throw new BadRequestException('Dữ liệu sản phẩm trong đơn hàng không hợp lệ');
      }
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const order = await this.prisma.order.create({
      data: {
        total: totalAmount,
        user: {
          connectOrCreate: {
            where: { id: user.id },
            create: {
              id: user.id,
              email: user.email,
              passwordHash: 'legacy-auth-user',
              role: user.role as UserRole,
            },
          },
        },
        items: {
          create: items.map((item) => ({
            productName: item.productName,
            size: item.size as ProductSize,
            toppings: item.toppings ?? [],
            note: item.note,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity,
            product: {
              connectOrCreate: {
                where: { id: String(item.productId) },
                create: {
                  id: String(item.productId),
                  name: item.productName,
                  price: item.unitPrice,
                  imageUrl: '',
                },
              },
            },
          })),
        },
      },
      include: { items: true },
    });

    return this.toOrder(order);
  }

  /**
   * Lấy đơn theo mã. Khi có `user` (route đã qua JwtAuthGuard), chỉ chủ đơn
   * hoặc ADMIN được xem; lời gọi nội bộ (payments…) không truyền `user`.
   */
  async findOne(id: string | number, user?: AuthUser): Promise<Order> {
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }
    if (user && user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('Chỉ được xem đơn hàng của chính mình');
    }
    return this.toOrder(order);
  }

  async updateStatus(
    id: string | number,
    status: 'PAID' | 'PAYMENT_FAILED',
    tx?: Prisma.TransactionClient,
  ): Promise<Order> {
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }

    try {
      const order = await (tx ?? this.prisma).order.update({
        where: { id: orderId },
        data: { status: status as OrderStatus },
        include: { items: true },
      });
      return this.toOrder(order);
    } catch {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }
  }

  private toOrder(order: {
    id: number;
    userId: string;
    total: number;
    status: OrderStatus;
    createdAt: Date;
    items: Array<{
      productId: string;
      productName: string;
      size: ProductSize;
      toppings: string[];
      note: string | null;
      qty: number;
      unitPrice: number;
    }>;
  }): Order {
    return {
      id: order.id,
      userId: order.userId,
      totalAmount: order.total,
      status: order.status === OrderStatus.PENDING ? 'PENDING_PAYMENT' : order.status,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productId: Number(item.productId),
        productName: item.productName,
        size: item.size,
        quantity: item.qty,
        unitPrice: item.unitPrice,
        toppings: item.toppings,
        note: item.note ?? undefined,
      })),
    };
  }
}
