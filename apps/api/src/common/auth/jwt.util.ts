import { createHmac, timingSafeEqual } from 'node:crypto';
import type { JwtPayload } from './auth-user.interface';

/**
 * Ký / xác thực JWT HS256 bằng `node:crypto` (không cần thư viện ngoài).
 * Tương thích với token do `@nestjs/jwt` / `jsonwebtoken` phát ra với cùng
 * JWT_SECRET và thuật toán mặc định HS256.
 */

export class InvalidTokenError extends Error {}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function signJwt(
  payload: JwtPayload,
  secret: string,
  expiresInSeconds = 60 * 60,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({ iat: now, exp: now + expiresInSeconds, ...payload }),
  );
  const signature = base64UrlEncode(hmac(`${header}.${body}`, secret));
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new InvalidTokenError('Token sai định dạng');
  const [header, body, signature] = parts;

  let headerJson: { alg?: string };
  let payload: JwtPayload;
  try {
    headerJson = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidTokenError('Token sai định dạng');
  }

  if (headerJson.alg !== 'HS256') {
    throw new InvalidTokenError('Thuật toán ký không được hỗ trợ');
  }

  const expected = hmac(`${header}.${body}`, secret);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InvalidTokenError('Chữ ký token không hợp lệ');
  }

  if (typeof payload.exp === 'number' && payload.exp <= nowSeconds) {
    throw new InvalidTokenError('Token đã hết hạn');
  }
  if (payload.sub === undefined || payload.sub === null || payload.sub === '') {
    throw new InvalidTokenError('Token thiếu thông tin người dùng');
  }
  return payload;
}
