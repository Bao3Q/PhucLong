import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService, parseExpiration } from './auth.service';
import { UsersRepository } from './users.repository';
import { verifyJwt } from '../common/auth/jwt.util';

const SECRET = 'unit_secret';

describe('AuthService', () => {
  let repo: UsersRepository;
  let service: AuthService;
  const originalSecret = process.env.JWT_SECRET;
  const originalRounds = process.env.BCRYPT_ROUNDS;

  beforeAll(() => {
    process.env.BCRYPT_ROUNDS = '4'; // test chạy nhanh
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalRounds === undefined) delete process.env.BCRYPT_ROUNDS;
    else process.env.BCRYPT_ROUNDS = originalRounds;
  });

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    repo = new UsersRepository();
    service = new AuthService(repo);
  });

  describe('register', () => {
    it('lưu mật khẩu đã băm bcrypt, không lưu mật khẩu gốc', async () => {
      const user = await service.register({
        email: 'kh@phuclong.vn',
        password: 'matkhau123',
      });

      const stored = await repo.findByEmail('kh@phuclong.vn');
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(stored?.passwordHash).not.toContain('matkhau123');
      expect(await bcrypt.compare('matkhau123', stored!.passwordHash)).toBe(
        true,
      );
      expect(user).toEqual({
        id: stored!.id,
        email: 'kh@phuclong.vn',
        role: 'CUSTOMER',
        loyaltyPoints: 0,
      });
    });

    it('không trả passwordHash ra ngoài', async () => {
      const user = await service.register({
        email: 'kh@phuclong.vn',
        password: 'matkhau123',
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('409 khi email đã tồn tại (không phân biệt hoa/thường)', async () => {
      await service.register({ email: 'kh@phuclong.vn', password: 'matkhau123' });
      await expect(
        service.register({ email: 'KH@Phuclong.vn', password: 'matkhau456' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({ email: 'kh@phuclong.vn', password: 'matkhau123' });
    });

    it('phát JWT hợp lệ có sub = id user và email', async () => {
      const result = await service.login({
        email: 'kh@phuclong.vn',
        password: 'matkhau123',
      });
      const payload = verifyJwt(result.accessToken, SECRET);

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(payload.sub).toBe(result.user.id);
      expect(payload.email).toBe('kh@phuclong.vn');
      expect(payload.role).toBe('CUSTOMER');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('đưa role ADMIN đã lưu vào thông tin user và JWT', async () => {
      const passwordHash = await bcrypt.hash('123456', 4);
      await repo.create('admin@phuclong.vn', passwordHash, 'ADMIN');

      const result = await service.login({
        email: 'admin@phuclong.vn',
        password: '123456',
      });

      expect(result.user.role).toBe('ADMIN');
      expect(verifyJwt(result.accessToken, SECRET).role).toBe('ADMIN');
    });

    it('401 khi sai mật khẩu', async () => {
      await expect(
        service.login({ email: 'kh@phuclong.vn', password: 'sai-mat-khau' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('401 cùng thông điệp khi email không tồn tại', async () => {
      const wrongPassword = await service
        .login({ email: 'kh@phuclong.vn', password: 'sai-mat-khau' })
        .catch((e: Error) => e.message);
      const unknownEmail = await service
        .login({ email: 'khong-co@phuclong.vn', password: 'matkhau123' })
        .catch((e: Error) => e.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('500 khi server chưa cấu hình JWT_SECRET', async () => {
      delete process.env.JWT_SECRET;
      await expect(
        service.login({ email: 'kh@phuclong.vn', password: 'matkhau123' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('onModuleInit (tạo ADMIN mặc định)', () => {
    const saved = {
      email: process.env.ADMIN_EMAIL,
      pw: process.env.ADMIN_PASSWORD,
      env: process.env.NODE_ENV,
    };
    afterEach(() => {
      for (const [k, v] of [
        ['ADMIN_EMAIL', saved.email],
        ['ADMIN_PASSWORD', saved.pw],
        ['NODE_ENV', saved.env],
      ] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    it('tạo admin@phuclong.vn với role ADMIN khi chạy dev', async () => {
      delete process.env.ADMIN_EMAIL;
      delete process.env.ADMIN_PASSWORD;
      process.env.NODE_ENV = 'test';
      await service.onModuleInit();
      const result = await service.login({
        email: 'admin@phuclong.vn',
        password: 'Admin@123456',
      });
      expect(result.user.role).toBe('ADMIN');
    });

    it('không tạo admin ở production nếu thiếu ADMIN_PASSWORD', async () => {
      delete process.env.ADMIN_PASSWORD;
      process.env.NODE_ENV = 'production';
      await service.onModuleInit();
      expect(await repo.findByEmail('admin@phuclong.vn')).toBeUndefined();
    });

    it('register luôn tạo CUSTOMER, không thể tự nâng quyền', async () => {
      const user = await service.register({
        email: 'x@phuclong.vn',
        password: 'matkhau123',
        // @ts-expect-error field lạ phải bị bỏ qua
        role: 'ADMIN',
      });
      expect(user.role).toBe('CUSTOMER');
    });
  });
});

describe('parseExpiration', () => {
  it('đọc được số giây và hậu tố s/m/h/d', () => {
    expect(parseExpiration('3600')).toBe(3600);
    expect(parseExpiration('30m')).toBe(1800);
    expect(parseExpiration('2h')).toBe(7200);
    expect(parseExpiration('1d')).toBe(86400);
  });
  it('sai / thiếu → mặc định 1 giờ', () => {
    expect(parseExpiration(undefined)).toBe(3600);
    expect(parseExpiration('abc')).toBe(3600);
    expect(parseExpiration('0')).toBe(3600);
  });
});
