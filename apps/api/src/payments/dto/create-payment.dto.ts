import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(2147483647)
  orderId: number;

  @IsIn(['momo', 'card'])
  method: 'momo' | 'card';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
