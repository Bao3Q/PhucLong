import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class CreateSePayCheckoutDto {
  @IsInt()
  orderId: number;

  /** Mở phiên mới sau khi phiên cũ hết hạn (khách bấm "Thanh toán lại"). */
  @IsOptional()
  @IsBoolean()
  restart?: boolean;
}
