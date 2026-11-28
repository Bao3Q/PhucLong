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
import { cancelOrderPayments } from './order-cancellation';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto, toOrderResponse } from './dto/order-response.dto';
import {
  Order,
  OrderItem,
  OrderStatus,
  assertTransition,
} from './entities/order.entity';
import { ProductsService } from '../products/products.service';
import { PromotionsService, VoucherAlreadyUsedException } from '../promotions/promotions.service';
import { SIZE_SURCHARGE, TOPPINGS } from '../products/products.data';

/** Topping hợp lệ — trùng bảng giá trong products.data.ts. */
const VALID_TOPPINGS = new Set(Object.keys(TOPPINGS));

/** Giới hạn độ dài ghi chú mỗi món. */
const MAX_NOTE_LENGTH = 200;

type NewOrder = {
  userId: string;
  items: Omit<OrderItem, 'id' | 'orderId'>[];
  subtotal: number;
  voucherCode?: string;
  loyaltyPointsToRedeem?: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Optional() private readonly productsService?: ProductsService,
    @Optional()
    @Inject(PrismaService)
    private readonly prisma?: PrismaService | null,
    @Optional() private readonly promotionsService?: PromotionsService,
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

    const pricedItems = await this.priceItems(items);
    const subtotal = pricedItems.reduce((sum, item) => {
      const nextSubtotal = sum + item.lineTotal;
      if (!Number.isSafeInteger(nextSubtotal)) {
        throw new BadRequestException('Tổng tiền đơn hàng không hợp lệ');
      }
      return nextSubtotal;
    }, 0);

    const draft: NewOrder = {
      userId: user.id,
      items: pricedItems,
      subtotal,
      voucherCode: createOrderDto.voucherCode?.trim().toUpperCase() || undefined,
      loyaltyPointsToRedeem:createOrderDto.loyaltyPointsToRedeem ?? 0,
    };

    const order = this.prisma
      ? await this.createDatabaseOrder(this.prisma, draft)
      : await this.createInMemoryOrder(draft);
    return toOrderResponse(order);
  }

  private async priceItems(
    items: CreateOrderDto['items'],
  ): Promise<NewOrder['items']> {
    // Không bao giờ tin tên/giá do browser gửi lên: tra catalog và tính giá trên server.
    const catalog = this.productsService ?? new ProductsService(this.prisma);
    return Promise.all(
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
  }

  private async priceWithVoucher(
    { userId, voucherCode, subtotal }: NewOrder,
    tx?: Prisma.TransactionClient,
  ) {
    if (!voucherCode) {
      return { discountAmount: 0, appliedVoucher: undefined, total: subtotal };
    }

    const promotions = this.promotionsService ?? new PromotionsService(this.prisma);
    if (tx) {
      // Xếp hàng theo cặp tài khoản/mã để lần kiểm tra sau thấy đơn vừa commit.
      const lockKey = JSON.stringify(['voucher', userId, voucherCode]);
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    }
    const applied = await promotions.validatePromotion(voucherCode, subtotal, userId, tx);
    return {
      discountAmount: applied.discountAmount,
      appliedVoucher: applied.code,
      total: Math.max(0, subtotal - applied.discountAmount),
    };
  }

  private async createDatabaseOrder(
    prisma: PrismaService,
    draft: NewOrder,
  ): Promise<Order> {
    const quantities = this.aggregateQuantities(draft.items);
    const createdOrderId = await prisma.$transaction(async (tx) => {
      // Kiểm tra voucher và điểm trong transaction, trước khi giữ tồn kho.
      // 1. Tính giảm giá voucher
    const {
      discountAmount,
      appliedVoucher,
      total: totalAfterVoucher,
    } = await this.priceWithVoucher(draft, tx);

    // 2. Lấy số điểm khách muốn đổi
    const pointsToRedeem = draft.loyaltyPointsToRedeem ?? 0;

    if (!Number.isSafeInteger(pointsToRedeem) || pointsToRedeem < 0) {
      throw new BadRequestException('Số điểm đổi không hợp lệ');
    }

    let loyaltyDiscountAmount = 0;
    let balanceAfter = 0;

    if (pointsToRedeem > 0) {

      // Chỉ cho đổi tối đa 20% giá trị đơn sau voucher
      const maxPoints = Math.floor(
        totalAfterVoucher * 0.2 / 1000
      );

      if (pointsToRedeem > maxPoints) {
        throw new BadRequestException(
          `Bạn chỉ được sử dụng tối đa ${maxPoints} điểm cho đơn hàng này`
        );
      }

      // Trừ điểm bằng updateMany để tránh hai yêu cầu cùng sử dụng
      // một số dư điểm.
      const updated = await tx.user.updateMany({
        where: {
          id: draft.userId,
          loyaltyPoints: {
            gte: pointsToRedeem,
          },
        },
        data: {
          loyaltyPoints: {
            decrement: pointsToRedeem,
          },
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'Số điểm thưởng của bạn không đủ'
        );
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: draft.userId },
        select: { loyaltyPoints: true },
      });

      balanceAfter = user.loyaltyPoints;

      // 1 điểm = 1.000đ
      loyaltyDiscountAmount = pointsToRedeem * 1000;

      // Ghi lịch sử đổi điểm
      await tx.loyaltyTransaction.create({
        data: {
          userId: draft.userId,
          type: 'REDEEM',
          points: -pointsToRedeem,
          balanceAfter,
          description: 'Đổi điểm giảm giá đơn hàng',
        },
      });
    }

    // 3. Tính tổng tiền sau cả voucher và điểm
    const total = Math.max(
      0,
      totalAfterVoucher - loyaltyDiscountAmount
    );

    // 4. Tiếp tục giữ tồn kho
    await this.reserveDatabaseStock(tx, quantities);
      const created = await tx.order.create({
        data: {
          userId: draft.userId,
          status: OrderStatus.PENDING,
          subtotal: draft.subtotal,

          discountAmount:
            discountAmount + loyaltyDiscountAmount,

          voucherDiscountAmount: discountAmount,
          loyaltyDiscountAmount,
          loyaltyPointsRedeemed: pointsToRedeem,

          voucherCode: appliedVoucher ?? null,
          total,
          items: {
            create: draft.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              size: item.size,
              toppings: [...item.toppings],
              note: item.note ?? null,
              qty: item.qty,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });
      if (appliedVoucher) {
        // Lượt dùng voucher chỉ bị trừ khi đơn thực sự được tạo thành công.
        const redemption = await tx.promotion.updateMany({
          where: {
            code: appliedVoucher,
            OR: [
              { usageLimit: null },
              { usedCount: { lt: tx.promotion.fields.usageLimit } },
            ],
          },
          data: { usedCount: { increment: 1 } },
        });
        if (redemption.count !== 1) {
          throw new BadRequestException(`Mã "${appliedVoucher}" đã hết lượt sử dụng`);
        }
      }
      return created.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    const saved = await this.ordersRepository.findById(createdOrderId);
    if (!saved) {
      throw new NotFoundException('Không tìm thấy đơn hàng vừa tạo');
    }
    return saved;
  }

  private async reserveDatabaseStock(
    tx: Prisma.TransactionClient,
    quantities: Map<string, number>,
  ): Promise<void> {
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
  }

  private async createInMemoryOrder(draft: NewOrder): Promise<Order> {
    const { discountAmount, appliedVoucher, total } =
      await this.priceWithVoucher(draft);
    const createAndSaveOrder = async (): Promise<Order> => {
      if (appliedVoucher && this.ordersRepository.hasVoucherInMemory(draft.userId, appliedVoucher)) {
        throw new VoucherAlreadyUsedException(appliedVoucher);
      }
      const orderId = this.ordersRepository.nextId();
      const now = new Date();
      return this.ordersRepository.save({
        id: orderId,
        userId: draft.userId,
        status: OrderStatus.PENDING,
        subtotal: draft.subtotal,
        discountAmount,
        voucherCode: appliedVoucher,
        total,
        createdAt: now,
        updatedAt: now,
        items: draft.items.map((item) => ({
          ...item,
          id: this.ordersRepository.nextItemIdValue(),
          orderId,
          toppings: [...item.toppings],
        })),
      });
    };

    if (!this.productsService) {
      return createAndSaveOrder();
    }

    return this.productsService.withStockReservation(
      draft.items,
      createAndSaveOrder,
    );
  }

  /**
   * PATCH /orders/:id/status – ADMIN cập nhật tiến độ; khách chỉ hủy đơn chưa trả tiền.
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

    const customerCancellation = user.role !== 'ADMIN';
    if (customerCancellation && nextStatus !== OrderStatus.CANCELLED) {
      throw new ForbiddenException('Chỉ nhân viên được cập nhật tiến độ đơn hàng');
    }
    if (nextStatus === OrderStatus.PAID || nextStatus === OrderStatus.PAYMENT_FAILED) {
      throw new ForbiddenException('Trạng thái thanh toán do hệ thống thanh toán cập nhật');
    }
    this.assertCancellationAllowed(order.status, customerCancellation);

    // Chặn sớm chuyển trạng thái không hợp lệ (trong transaction còn kiểm tra lại).
    assertTransition(order.status, nextStatus);

    if (this.prisma) {
      return toOrderResponse(
        await this.updateDatabaseStatus(this.prisma, orderId, nextStatus, customerCancellation),
      );
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
      return this.updateDatabaseStatus(this.prisma, orderId, nextStatus);
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

  async lockOrder(tx: Prisma.TransactionClient, orderId: number): Promise<void> {
    // Checkout, webhook và hủy đơn lấy cùng một khóa trước khi chạm vào Payment.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  }

  async cancelExpiredOrder(orderId: number, cutoff: Date): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const eligible = await tx.order.findFirst({
        where: {
          id: orderId,
          status: { in: [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED] },
          createdAt: { lt: cutoff },
          payments: { none: { status: 'PENDING', expiresAt: { gt: new Date() } } },
        },
        select: { id: true },
      });
      if (eligible) {
        await this.applyStatusTransition(tx, orderId, OrderStatus.CANCELLED);
      }
    });
  }

  private assertCancellationAllowed(status: string, customerCancellation: boolean): void {
    if (customerCancellation && status === OrderStatus.PAID) {
      throw new ForbiddenException('Đơn đã thanh toán cần nhân viên xử lý hoàn tiền');
    }
  }

  private async updateDatabaseStatus(
    prisma: PrismaService,
    orderId: number,
    nextStatus: OrderStatus,
    customerCancellation = false,
  ): Promise<Order> {
    await prisma.$transaction(async (tx) => {
      await this.applyStatusTransition(tx, orderId, nextStatus, customerCancellation);
    });
    const updated = await this.ordersRepository.findById(orderId);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    return updated;
  }

  /**
   * Lõi chuyển trạng thái chạy trong một transaction: re-read dòng mới nhất,
   * assertTransition lần nữa, hoàn tồn kho nếu hủy đơn, rồi CAS theo status cũ.
   */
  private async applyStatusTransition(
    tx: Prisma.TransactionClient,
    orderId: number,
    nextStatus: OrderStatus,
    customerCancellation = false,
  ): Promise<Order> {
    await this.lockOrder(tx, orderId);
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current) {
      throw new NotFoundException(`Không tìm thấy đơn hàng #${orderId}`);
    }
    this.assertCancellationAllowed(current.status, customerCancellation);
    assertTransition(current.status as OrderStatus, nextStatus);

    if (nextStatus === OrderStatus.CANCELLED) {
      // Hoàn stock theo thứ tự id đã sort để nhất quán với luồng trừ stock.
      const quantities = this.aggregateQuantities(current.items);
      for (const [productId, qty] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: qty }, version: { increment: 1 } },
        });
      }
      await cancelOrderPayments(tx, current);
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
