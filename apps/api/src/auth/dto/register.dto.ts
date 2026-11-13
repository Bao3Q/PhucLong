import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * bcrypt chỉ dùng tối đa 72 byte đầu của mật khẩu, nên giới hạn độ dài
 * để tránh việc hai mật khẩu khác nhau cho cùng một hash.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254, { message: 'Email quá dài' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự`,
  })
  password: string;
}
