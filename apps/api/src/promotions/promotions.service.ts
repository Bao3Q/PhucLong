import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Row Promotion rút gọn cho việc tính giảm giá. */
export interface PromotionView {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
}

/**
 * Voucher dự phòng cho nhánh in-memory (unit test không có DB) — khớp seed
 * WELCOME10 trong migration 20261113100000 và prisma/schema.sql.
 */
export const FALLBACK_VOUCHERS: Record<string, PromotionView> = {
  WELCOME10: {
    code: 'WELCOME10',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 20000,
    minOrderAmount: 50000,
    usageLimit: 1000,
    usedCount: 0,
    isActive: true,
    startsAt: new Date(0),
    endsAt: null,
  },
};

export interface PromotionResult {
  code: string;
  discountAmount: number;
  total: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {}

  /**
   * Kiểm tra voucher và tính giảm giá. Hết hạn/hết lượt/đơn quá nhỏ → BadRequest
   * với lý do tiếng Việt để UI hiện thẳng cho khách. Với tx (dùng trong
   * transaction tạo đơn) thì đọc dòng dữ liệu mới nhất trong transaction đó.
   */
  async validatePromotion(
    code: string,
    subtotal: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PromotionResult> {
    const normalized = code.trim().toUpperCase();
    const client: Prisma.TransactionClient | PrismaService | null =
      tx ?? this.prisma ?? null;

    let promo: PromotionView | undefined;
    if (client) {
      promo = (await client.promotion.findUnique({
        where: { code: normalized },
      })) ?? undefined;
    } else {
      promo = FALLBACK_VOUCHERS[normalized];
    }

    if (!promo) {
      throw new BadRequestException(`Mã giảm giá "${normalized}" không tồn tại`);
    }
    if (!promo.isActive) {
      throw new BadRequestException(`Mã giảm giá "${normalized}" không còn hiệu lực`);
    }
    const now = new Date();
    if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) {
      throw new BadRequestException(`Mã "${normalized}" chưa đến ngày áp dụng`);
    }
    if (promo.endsAt && promo.endsAt.getTime() < now.getTime()) {
      throw new BadRequestException(`Mã "${normalized}" đã hết hạn sử dụng`);
    }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException(`Mã "${normalized}" đã hết lượt sử dụng`);
    }
    if (subtotal < promo.minOrderAmount) {
      throw new BadRequestException(
        `Mã "${normalized}" áp dụng cho đơn từ ${promo.minOrderAmount.toLocaleString('vi-VN')}đ`,
      );
    }

    const discountAmount =
      promo.discountType === 'PERCENT'
        ? Math.min(
            promo.maxDiscountAmount ?? Number.MAX_SAFE_INTEGER,
            Math.round((subtotal * promo.discountValue) / 100),
          )
        : Math.min(promo.discountValue, subtotal);

    const total = Math.max(0, subtotal - Math.min(discountAmount, subtotal));
    return { code: normalized, discountAmount, total };
  }

  /** Endpoint POST /promotions/validate — chỉ xem trước, không tiêu lượt dùng. */
  async validate(code: string, subtotal: number): Promise<PromotionResult> {
    return this.validatePromotion(code, subtotal);
  }
}
