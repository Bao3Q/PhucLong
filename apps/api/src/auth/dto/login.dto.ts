import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  // Không kiểm tra độ dài tối thiểu ở đây: sai thì trả 401 chung chung,
  // không tiết lộ quy tắc mật khẩu. Chỉ chặn chuỗi quá lớn.
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @MaxLength(72, { message: 'Mật khẩu không hợp lệ' })
  password: string;
}
