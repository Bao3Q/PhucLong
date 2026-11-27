import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdatePromotionDto {

  @IsString()
  @IsOptional()
  @MaxLength(32)
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['PERCENT', 'FIXED'])
  @IsOptional()
  discountType?: 'PERCENT' | 'FIXED';

  @IsInt()
  @Min(1)
  @IsOptional()
  discountValue?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxDiscountAmount?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}