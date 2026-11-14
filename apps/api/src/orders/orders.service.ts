import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { AuthUser } from '../common/auth/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';
import {
  Order,
  OrderStatus,
  assertTransition,
} from './entities/order.entity';
import { ProductsService } from '../products/products.service';
import { SIZE_SURCHARGE, TOPPINGS } from '../products/products.data';

/** Topping hợp lệ — trùng bảng giá trong products.data.ts. */
const VALID_TOPPINGS = new Set(Object.keys(TOPPINGS));

/** Giới hạn độ dài ghi chú mỗi món. */
const MAX_NOTE_LENGTH = 200;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Optional() private readonly productsService?: ProductsService,
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService | null,
  ) {}

  /** GET /orders/me – lịch sử đơn của user đang đăng nhập (mới nhất trước). */
  async findMyOrders(userId: string): Promise<OrderResponseDto[]> {
    return (await this.ordersRepository.findByUserId(userId)).map(
      toOrderResponse,
    );
  }

  /** POST /orders – Tạo đơn hàng mới với trạng thái PENDING. */
  async createOrder(
    user: AuthUser,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const items = createOrderDto.items;
    if (!items || items.length === 0) {
      throw new BadRequestException('Giỏ hàng không được để trống');
    }

    for (const item of items) {
      if (
        !item.productId ||
        !Number.isSafeInteger(item.qty) ||
        item.qty <= 0 ||
        !Object.keys(SIZE_SURCHARGE).includes(item.size) ||
        (item.toppings ?? []).some((topping) => !VALID_TOPPINGS.has(topping)) ||
        new Set(item.toppings ?? []).size !== (item.toppings ?? []).length ||
        (item.note ?? '').length > MAX_NOTE_LENGTH
      ) {
        throw new BadRequestException(
          'Thông tin sản phẩm trong đơn không hợp lệ',
        );
      }
    }

    // Không bao giờ tin tên/giá do browser gửi lên: tra catalog và tính giá trên server.
    const catalog = this.productsService ?? new ProductsService(this.prisma);
    const normalizedItems = await Promise.all(
      items.map(async (item) => {
        const product = await catalog.findOneFromStorage(item.productId);
        if (!product) {
          throw new NotFoundException(
            `Sản phẩm với ID ${item.productId} không tồn tại`,
          );
        }
        const toppings = item.toppings ? [...item.toppings] : [];
        const unitPrice =
          product.price +
          SIZE_SURCHARGE[item.size] +
          toppings.reduce((sum, t) => sum + (TOPPINGS[t] ?? 0), 0);
        return {
          productId: item.productId,
          productName: product.name,
          size: item.size,
          toppings,
          note: item.note,
          qty: item.qty,
          unitPrice,
          lineTotal: unitPrice * item.qty,
        };
      }),
    );

    const subtotal = normalizedItems.reduce((sum, item) => {
      const nextSubtotal = sum + item.lineTotal;
      if (!Number.isSafeInteger(nextSubtotal)) {
        throw new BadRequestException('Tổng tiền đơn hàng không hợp lệ');
      }
      return nextSubtotal;
    }, 0);
    const total = subtotal;

    if (this.prisma) {
      const quantities = this.aggregateQuantities(normalizedItems);
      const createdOrderId = await this.prisma.$transaction(async (tx) => {
        // Thứ tự khóa nhất quán (sort theo id) tránh deadlock khi giỏ có món ngược nhau.
        for (const [productId, qty] of [...quantities].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          const product = await tx.product.findUnique({
            where: { id: productId },
          });
          if (!product) {
            throw new NotFoundException(
              `Sản phẩm với ID ${productId} không tồn tại`,
            );
          }
          if (product.stock < qty) {
            throw new BadRequestException(
              `Sản phẩm "${product.name}" không đủ số lượng tồn kho (còn ${product.stock}, yêu cầu ${qty})`,
            );
          }
          // Optimistic lock trên Product.version: chỉ một request giành được stock.
          const updated = await tx.product.updateMany({
            where: { id: productId, version: product.version, stock: { gte: qty } },
            data: { stock: { decrement: qty }, version: { increment: 1 } },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              `Tồn kho sản phẩm "${product.name}" vừa được thay đổi, vui lòng thử lại`,
            );
          }
        }

        const created = await tx.order.create({
          data: {
            userId: user.id,
            status: OrderStatus.PENDING,
            subtotal,
            discountAmount: 0,
            total,
            items: {
              create: normalizedItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                size: item.size as 'S' | 'M' | 'L',
                toppings: [...item.toppings],
                note: item.note ?? null,
                qty: item.qty,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
              })),
            },
          },
        });
        return created.id;
      });
      const saved = await this.ordersRepository.findById(createdOrderId);
      if (!saved) {
        throw new NotFoundException('Không tìm thấy đơn hàng vừa tạo');
      }
      return toOrderResponse(saved);
    }

    // Nhánh in-memory (test): trừ stock qua mutex, tạo đơn, lỗi thì hoàn stock.
    const createAndSaveOrder = async (): Promise<OrderResponseDto> => {
      const orderId = this.ordersRepository.nextId();
      const now = new Date();
      const newOrder: Order = {
        id: orderId,
        userId: user.id,
        status: OrderStatus.PENDING,
        subtotal,
        discountAmount: 0,
        total,
        createdAt: now,
        updatedAt: now,
        items: normalizedItems.map((item) => ({
          id: this.ordersRepository.nextItemIdValue(),
          orderId,
          productId: item.productId,
          productName: item.productName,
          size: item.size,
          toppings: [...item.toppings],
          note: item.note,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      };
      return toOrderResponse(await this.ordersRepository.save(newOrder));
    };

    if (!this.productsService) {
      return await createAndSaveOrder();
    }

    return this.productsService.withStockReservation(
      normalizedItems.map(({ productId, qty }) => ({ productId, qty })),
      createAndSaveOrder,
    );
  }

  /**
   * PATCH /orders/:id/status – Chuyển trạng thái đơn (chủ đơn hoặc ADMIN).
   * assertTransition chặn bước không hợp lệ; hủy đơn (CANCELLED) hoàn tồn kho.
   */
  async updateOrderStatus(
    user: AuthUser,
    orderId: number,
    nextStatus: OrderStatus,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('Chỉ được cập nhật đơn hàng của chính mình');
    }

    // Chặn sớm chuyển trạng thái không hợp lệ (trong transaction còn kiểm tra lại).
    assertTransition(order.status, nextStatus);

    if (this.prisma) {
      await this.prisma.$transaction(async (tx) => {
        await this.applyStatusTransition(tx, orderId, nextStatus);
      });
      const updated = await this.ordersRepository.findById(orderId);
      if (!updated) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
      }
      return toOrderResponse(updated);
    }

    const expectedStatus = order.status;
    const saveStatus = async (): Promise<Order> => {
      order.status = nextStatus;
      order.updatedAt = new Date();
      return this.ordersRepository.saveStatus(order, expectedStatus);
    };

    if (nextStatus === OrderStatus.CANCELLED && this.productsService) {
      return toOrderResponse(
        await this.productsService.withStockRestoration(
          order.items.map(({ productId, qty }) => ({ productId, qty })),
          saveStatus,
        ),
      );
    }

    return toOrderResponse(await saveStatus());
  }

  /**
   * Đổi trạng thái một đơn (dùng nội bộ bởi PaymentsService, có thể nằm trong
   * transaction thanh toán của nó). Kiểm tra assertTransition trên dòng dữ
   * liệu mới nhất trong transaction và CAS theo status hiện tại.
   */
  async updateStatus(
    orderId: number,
    nextStatus: OrderStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Order> {
    if (tx) {
      return this.applyStatusTransition(tx, orderId, nextStatus);
    }

    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    assertTransition(order.status, nextStatus);

    if (this.prisma) {
      await this.prisma.$transaction(async (prismaTx) => {
        await this.applyStatusTransition(prismaTx, orderId, nextStatus);
      });
      const updated = await this.ordersRepository.findById(orderId);
      if (!updated) {
        throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
      }
      return updated;
    }

    const expectedStatus = order.status;
    order.status = nextStatus;
    order.updatedAt = new Date();
    return this.ordersRepository.saveStatus(order, expectedStatus);
  }

  /**
   * GET /orders/:id – chi tiết một đơn. Khi có `user` (route đã qua JwtAuthGuard),
   * chỉ chủ đơn hoặc ADMIN được xem; lời gọi nội bộ (payments…) không truyền `user`.
   */
  async findOne(id: string | number, user?: AuthUser): Promise<Order> {
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }

    const order = await this.ordersRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với mã ${id}`);
    }
    if (user && user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new ForbiddenException('Chỉ được xem đơn hàng của chính mình');
    }
    return order;
  }

  /**
   * Lõi chuyển trạng thái chạy trong một transaction: re-read dòng mới nhất,
   * assertTransition lần nữa, hoàn tồn kho nếu hủy đơn, rồi CAS theo status cũ.
   */
  private async applyStatusTransition(
    tx: Prisma.TransactionClient,
    orderId: number,
    nextStatus: OrderStatus,
  ): Promise<Order> {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    assertTransition(current.status as OrderStatus, nextStatus);

    if (nextStatus === OrderStatus.CANCELLED) {
      // Hoàn stock theo thứ tự id đã sort để nhất quán với luồng trừ stock.
      const quantities = this.aggregateQuantities(
        current.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          size: item.size as 'S' | 'M' | 'L',
          toppings: item.toppings,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      );
      for (const [productId, qty] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: qty }, version: { increment: 1 } },
        });
      }
    }

    const updated = await tx.order.updateMany({
      where: { id: orderId, status: current.status },
      data: { status: nextStatus },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Trạng thái đơn hàng vừa được thay đổi, vui lòng thử lại',
      );
    }

    const refreshed = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!refreshed) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    return this.ordersRepository.fromPrisma(refreshed);
  }

  /** Gom số lượng theo productId (các dòng trùng cộng dồn). */
  private aggregateQuantities(
    items: Array<{ productId: string; qty: number }>,
  ): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const { productId, qty } of items) {
      const totalQty = (quantities.get(productId) ?? 0) + qty;
      if (!Number.isSafeInteger(totalQty)) {
        throw new BadRequestException('Tổng số lượng sản phẩm không hợp lệ');
      }
      quantities.set(productId, totalQty);
    }
    return quantities;
  }
}
