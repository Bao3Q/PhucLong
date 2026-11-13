import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { signJwt } from '../common/auth/jwt.util';
import { UsersRepository } from './users.repository';
import { PublicUser, toPublicUser } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Thời gian sống mặc định của token: 1 giờ. */
export const DEFAULT_JWT_EXPIRES_IN_SECONDS = 60 * 60;

/**
 * Đọc JWT_EXPIRATION: số giây ("3600") hoặc có hậu tố s/m/h/d ("30m", "1d").
 * Giá trị sai / thiếu → mặc định 1 giờ.
 */
export function parseExpiration(raw?: string): number {
  const match = /^(\d+)\s*([smhd]?)$/i.exec((raw ?? '').trim());
  if (!match) return DEFAULT_JWT_EXPIRES_IN_SECONDS;
  const unit = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[
    match[2].toLowerCase() as '' | 's' | 'm' | 'h' | 'd'
  ];
  const seconds = Number(match[1]) * unit;
  return seconds > 0 ? seconds : DEFAULT_JWT_EXPIRES_IN_SECONDS;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  /** Số giây token còn hiệu lực. */
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  /** Hash giả để so sánh khi email không tồn tại (tránh lộ email qua thời gian phản hồi). */
  private dummyHash?: Promise<string>;

  constructor(private readonly usersRepository: UsersRepository) {}

  private get saltRounds(): number {
    const rounds = Number(process.env.BCRYPT_ROUNDS);
    return Number.isInteger(rounds) && rounds >= 4 && rounds <= 15
      ? rounds
      : 10;
  }

  /**
   * Tạo sẵn tài khoản ADMIN khi khởi động (kho user đang nằm trong bộ nhớ nên
   * mỗi lần chạy lại đều mất dữ liệu). Cấu hình qua ADMIN_EMAIL / ADMIN_PASSWORD.
   * Ở môi trường production, nếu chưa đặt ADMIN_PASSWORD thì KHÔNG tạo admin.
   */
  async onModuleInit(): Promise<void> {
    const isProd = process.env.NODE_ENV === 'production';
    const email = process.env.ADMIN_EMAIL ?? 'admin@phuclong.vn';
    const password =
      process.env.ADMIN_PASSWORD ?? (isProd ? undefined : 'Admin@123456');
    if (!password) {
      this.logger.warn('Bỏ qua tạo ADMIN mặc định: chưa đặt ADMIN_PASSWORD');
      return;
    }
    const hash = await bcrypt.hash(password, this.saltRounds);
    const created = await this.usersRepository.create(email, hash, 'ADMIN');
    if (created) this.logger.log(`Đã tạo tài khoản ADMIN: ${email}`);
  }

  /** POST /auth/register – băm mật khẩu bằng bcrypt rồi lưu (luôn role CUSTOMER). */
  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const user = await this.usersRepository.create(dto.email, passwordHash);
    if (!user) {
      throw new ConflictException('Email đã được đăng ký');
    }
    return toPublicUser(user);
  }

  /** POST /auth/login – kiểm tra mật khẩu và phát JWT (HS256). */
  async login(dto: LoginDto): Promise<LoginResult> {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('Server chưa cấu hình JWT_SECRET');
    }

    const user = await this.usersRepository.findByEmail(dto.email);
    // Luôn chạy bcrypt.compare dù không có user để thời gian phản hồi
    // không cho biết email có tồn tại hay không.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matched = await bcrypt.compare(dto.password, hash);
    if (!user || !matched) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const expiresIn = parseExpiration(process.env.JWT_EXPIRATION);
    // `sub` = id user, khớp với cách JwtAuthGuard đọc (request.user.id).
    const accessToken = signJwt(
      { sub: user.id, email: user.email, role: user.role },
      secret,
      expiresIn,
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: toPublicUser(user),
    };
  }

  /** Thông tin user hiện tại (dùng cho GET /auth/me). */
  async getProfile(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại');
    return toPublicUser(user);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= bcrypt.hash('dummy-password', this.saltRounds);
    return this.dummyHash;
  }
}
