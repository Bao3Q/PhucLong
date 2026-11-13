import type { UserRole } from '../../auth/entities/user.entity';

/** Thông tin user lấy từ JWT, được JwtAuthGuard gắn vào `request.user`. */
export interface AuthUser {
  id: string;
  email?: string;
  role?: UserRole;
}

/** Payload JWT do POST /auth/login phát ra. */
export interface JwtPayload {
  sub: string | number;
  email?: string;
  role?: UserRole;
  iat?: number;
  exp?: number;
}
