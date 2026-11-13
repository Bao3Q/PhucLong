import {
  ExecutionContext,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { signJwt, verifyJwt, InvalidTokenError } from './jwt.util';

const SECRET = 'test_secret';

function contextWith(authorization?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('jwt.util', () => {
  it('ký rồi xác thực lại được payload', () => {
    const token = signJwt({ sub: 7, email: 'a@b.c' }, SECRET);
    expect(verifyJwt(token, SECRET)).toMatchObject({ sub: 7, email: 'a@b.c' });
  });

  it('từ chối token sai chữ ký', () => {
    const token = signJwt({ sub: 7 }, 'other_secret');
    expect(() => verifyJwt(token, SECRET)).toThrow(InvalidTokenError);
  });

  it('từ chối token hết hạn', () => {
    const token = signJwt({ sub: 7 }, SECRET, -10);
    expect(() => verifyJwt(token, SECRET)).toThrow('Token đã hết hạn');
  });

  it('từ chối token bị sửa payload', () => {
    const [h, , s] = signJwt({ sub: 7 }, SECRET).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 1 })).toString(
      'base64url',
    );
    expect(() => verifyJwt(`${h}.${forged}.${s}`, SECRET)).toThrow(
      InvalidTokenError,
    );
  });

  it('từ chối token rác', () => {
    expect(() => verifyJwt('abc', SECRET)).toThrow(InvalidTokenError);
    expect(() => verifyJwt('a.b.c', SECRET)).toThrow(InvalidTokenError);
  });
});

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();
  const original = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('cho qua và gắn request.user khi token hợp lệ', () => {
    const { ctx, request } = contextWith(
      `Bearer ${signJwt({ sub: 42, email: 'kh@phuclong.vn' }, SECRET)}`,
    );
    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual({ id: '42', email: 'kh@phuclong.vn' });
  });

  it('401 khi thiếu header Authorization', () => {
    expect(() => guard.canActivate(contextWith().ctx)).toThrow(
      UnauthorizedException,
    );
  });

  it('401 khi sai scheme', () => {
    const token = signJwt({ sub: 1 }, SECRET);
    expect(() => guard.canActivate(contextWith(`Basic ${token}`).ctx)).toThrow(
      UnauthorizedException,
    );
  });

  it('401 khi token không hợp lệ', () => {
    expect(() =>
      guard.canActivate(contextWith('Bearer khong.hop.le').ctx),
    ).toThrow(UnauthorizedException);
  });

  it('500 khi server chưa cấu hình JWT_SECRET', () => {
    delete process.env.JWT_SECRET;
    expect(() =>
      guard.canActivate(contextWith('Bearer a.b.c').ctx),
    ).toThrow(InternalServerErrorException);
  });
});
