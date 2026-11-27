import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum OrderSize {
  S = 'S',
  M = 'M',
  L = 'L',
}

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsEnum(OrderSize)
  @IsNotEmpty()
  size: OrderSize;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toppings?: string[];

  @IsInt()
  @Min(1)
  qty: number;

  @IsString()
  @IsOptional()
  note?: string;
}

/**
 * Client chỉ gửi danh sách món (không gửi giá): backend tự tra bảng giá
 * và tính unitPrice / lineTotal — không bao giờ tin tiền do browser gửi lên.
 */

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  // Mã voucher khách hàng nhập
  @IsString()
  @IsOptional()
  @MaxLength(32)
  voucherCode?: string;

  // Số điểm khách hàng muốn đổi
  @IsInt()
  @Min(0)
  @IsOptional()
  loyaltyPointsToRedeem?: number;
}