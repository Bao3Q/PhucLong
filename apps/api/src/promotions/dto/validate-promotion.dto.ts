import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** POST /promotions/validate — kiểm tra voucher có áp dụng được cho đơn chưa tạo. */
export class ValidatePromotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;

  @IsInt()
  @Min(0)
  subtotal: number;
}
