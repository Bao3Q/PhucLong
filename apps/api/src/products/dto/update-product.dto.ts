import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** Mọi field đều tùy chọn: chỉ gửi những gì cần sửa (PATCH). */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  image?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}
