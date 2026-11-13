import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';

/**
 * Đăng ký / đăng nhập bằng JWT + phân quyền theo role (CUSTOMER / ADMIN).
 *
 * Route cần đăng nhập chỉ cần `@UseGuards(JwtAuthGuard)`; route chỉ dành
 * cho admin thêm `RolesGuard` và `@Roles('ADMIN')` (xem ProductsController).
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, UsersRepository, JwtAuthGuard, RolesGuard],
  exports: [UsersRepository, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
