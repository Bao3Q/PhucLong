import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService, LoginResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { PublicUser } from './entities/user.entity';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user.interface';

/** Validate ngay tại controller: bỏ field lạ, tự chuẩn hóa email. */
const bodyPipe = new ValidationPipe({ whitelist: true, transform: true });

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Đăng ký tài khoản mới → 201 + thông tin user (không có mật khẩu). */
  @Post('register')
  register(@Body(bodyPipe) dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  /** Đăng nhập → 200 + JWT để gọi các route cần đăng nhập. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(bodyPipe) dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  /** Route mẫu được guard bảo vệ: trả về user đang đăng nhập (401 nếu không có JWT hợp lệ). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.authService.getProfile(user.id);
  }
}
