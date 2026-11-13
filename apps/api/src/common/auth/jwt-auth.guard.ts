import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user.interface';
import { InvalidTokenError, verifyJwt } from './jwt.util';

/**
 * Bảo vệ route bằng header `Authorization: Bearer <JWT>`.
 *
 * Token được ký HS256 bằng JWT_SECRET (do POST /auth/login phát ra).
 * Khi cần, có thể thay guard này bằng guard Passport
 * miễn là `request.user` vẫn có dạng { id, email }.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'Server chưa cấu hình JWT_SECRET',
      );
    }

    const header = request.headers.authorization;
    const [scheme, token] = (header ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Thiếu token đăng nhập');
    }

    try {
      const payload = verifyJwt(token, secret);
      request.user = {
        id: String(payload.sub),
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }
}
