import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Size/topping không còn do admin tự khai báo: giá tính tiền phía server dựa
 * trên hằng số chuẩn (SIZE_SURCHARGE, TOPPINGS trong products.data.ts) nên
 * mọi sản phẩm dùng chung bộ size S/M/L và topping của quán.
 */
export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsInt()
  @Min(0)
  basePrice: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;
}
