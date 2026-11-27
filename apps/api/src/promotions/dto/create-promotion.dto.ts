import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsIn,
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePromotionDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['PERCENT', 'FIXED'])
  discountType: 'PERCENT' | 'FIXED';

  @IsInt()
  @Min(1)
  discountValue: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxDiscountAmount?: number;

  @IsInt()
  @Min(0)
  minOrderAmount: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}