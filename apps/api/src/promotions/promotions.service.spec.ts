import { BadRequestException } from '@nestjs/common';
import { PromotionsService, FALLBACK_VOUCHERS } from './promotions.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PromotionsService (nhánh in-memory — bảng fallback WELCOME10)', () => {
  const service = new PromotionsService(null);

  it('WELCOME10 giảm 10% tối đa 20.000đ cho đơn từ 50.000đ', async () => {
    const result = await service.validate('welcome10', 130000);
    expect(result).toEqual({ code: 'WELCOME10', discountAmount: 13000, total: 117000 });
  });

  it('giảm giá bị chặn bởi maxDiscountAmount', async () => {
    // 10% của 500.000 = 50.000đ nhưng max là 20.000đ
    const result = await service.validate('WELCOME10', 500000);
    expect(result.discountAmount).toBe(20000);
    expect(result.total).toBe(480000);
  });

  it('đơn dưới mức tối thiểu → 400 kèm ngưỡng', async () => {
    await expect(service.validate('WELCOME10', 40000)).rejects.toThrow(
      new BadRequestException('Mã "WELCOME10" áp dụng cho đơn từ 50.000đ'),
    );
  });

  it('mã không tồn tại → 400', async () => {
    await expect(service.validate('GIA-MA', 130000)).rejects.toThrow(BadRequestException);
  });

  it('fallbackvoucher có đúng 1 mã seed', () => {
    expect(Object.keys(FALLBACK_VOUCHERS)).toEqual(['WELCOME10']);
  });
});

describe('PromotionsService (nhánh Prisma — mock)', () => {
  function serviceWith(promotion: unknown): PromotionsService {
    const prisma = {
      promotion: { findUnique: jest.fn().mockResolvedValue(promotion) },
    };
    return new PromotionsService(prisma as unknown as PrismaService);
  }

  it('voucher FIXED giảm đúng số tiền, không vượt subtotal', async () => {
    const svc = serviceWith({
      code: 'GIAM5K',
      discountType: 'FIXED',
      discountValue: 5000,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      usageLimit: null,
      usedCount: 0,
      isActive: true,
      startsAt: new Date(0),
      endsAt: null,
    });
    const result = await svc.validate('giam5k', 20000);
    expect(result).toEqual({ code: 'GIAM5K', discountAmount: 5000, total: 15000 });
  });

  it('voucher hết hạn → 400', async () => {
    const svc = serviceWith({
      code: 'HETHAN',
      discountType: 'PERCENT',
      discountValue: 50,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      usageLimit: null,
      usedCount: 0,
      isActive: true,
      startsAt: new Date(0),
      endsAt: new Date(Date.now() - 1000),
    });
    await expect(svc.validate('HETHAN', 100000)).rejects.toThrow(BadRequestException);
  });

  it('voucher hết lượt sử dụng → 400', async () => {
    const svc = serviceWith({
      code: 'HETLUOT',
      discountType: 'PERCENT',
      discountValue: 50,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      usageLimit: 100,
      usedCount: 100,
      isActive: true,
      startsAt: new Date(0),
      endsAt: null,
    });
    await expect(svc.validate('HETLUOT', 100000)).rejects.toThrow(BadRequestException);
  });

  it('voucher bị vô hiệu hóa → 400', async () => {
    const svc = serviceWith({
      code: 'TAT',
      discountType: 'PERCENT',
      discountValue: 50,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      usageLimit: null,
      usedCount: 0,
      isActive: false,
      startsAt: new Date(0),
      endsAt: null,
    });
    await expect(svc.validate('TAT', 100000)).rejects.toThrow(BadRequestException);
  });
});
