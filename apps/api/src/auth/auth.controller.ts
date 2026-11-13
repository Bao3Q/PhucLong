import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService, LoginResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { PublicUser } from './entities/user.entity';

/**
 * Validate đầu vào ngay tại controller (không phụ thuộc ValidationPipe toàn
 * cục trong main.ts): bỏ field lạ, tự chuẩn hóa email.
 */
const bodyPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Đăng ký tài khoản mới → 201 + thông tin user (không có mật khẩu). */
  @Post('register')
  register(@Body(bodyPipe) dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  /** Đăng nhập → 200 + JWT để gọi các route cần đăng nhập (vd. /orders). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(bodyPipe) dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }
}
