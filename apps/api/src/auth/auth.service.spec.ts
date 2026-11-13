import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
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
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      });

      const stored = await repo.findByEmail('kh@maycha.vn');
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(stored?.passwordHash).not.toContain('matkhau123');
      expect(await bcrypt.compare('matkhau123', stored!.passwordHash)).toBe(
        true,
      );
      expect(user).toEqual({
        id: stored!.id,
        email: 'kh@maycha.vn',
        role: 'CUSTOMER',
        loyaltyPoints: 0,
      });
    });

    it('không trả passwordHash ra ngoài', async () => {
      const user = await service.register({
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('409 khi email đã tồn tại (không phân biệt hoa/thường)', async () => {
      await service.register({ email: 'kh@maycha.vn', password: 'matkhau123' });
      await expect(
        service.register({ email: 'KH@Maycha.vn', password: 'matkhau456' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({ email: 'kh@maycha.vn', password: 'matkhau123' });
    });

    it('phát JWT hợp lệ có sub = id user và email', async () => {
      const result = await service.login({
        email: 'kh@maycha.vn',
        password: 'matkhau123',
      });
      const payload = verifyJwt(result.accessToken, SECRET);

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(payload.sub).toBe(result.user.id);
      expect(payload.email).toBe('kh@maycha.vn');
      expect(payload.role).toBe('CUSTOMER');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('đưa role ADMIN đã lưu vào thông tin user và JWT', async () => {
      const passwordHash = await bcrypt.hash('123456', 4);
      await repo.create('quanly@maycha.vn', passwordHash, 'ADMIN');

      const result = await service.login({
        email: 'quanly@maycha.vn',
        password: '123456',
      });

      expect(result.user.role).toBe('ADMIN');
      expect(verifyJwt(result.accessToken, SECRET).role).toBe('ADMIN');
    });

    it('401 khi sai mật khẩu', async () => {
      await expect(
        service.login({ email: 'kh@maycha.vn', password: 'sai-mat-khau' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('401 cùng thông điệp khi email không tồn tại', async () => {
      const wrongPassword = await service
        .login({ email: 'kh@maycha.vn', password: 'sai-mat-khau' })
        .catch((e: Error) => e.message);
      const unknownEmail = await service
        .login({ email: 'khong-co@maycha.vn', password: 'matkhau123' })
        .catch((e: Error) => e.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('500 khi server chưa cấu hình JWT_SECRET', async () => {
      delete process.env.JWT_SECRET;
      await expect(
        service.login({ email: 'kh@maycha.vn', password: 'matkhau123' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  it('có sẵn tài khoản ADMIN mặc định (admin@maycha.vn / Admin@123456)', async () => {
    const result = await service.login({
      email: 'admin@maycha.vn',
      password: 'Admin@123456',
    });
    expect(result.user.role).toBe('ADMIN');
  });
});
