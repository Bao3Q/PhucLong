import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { signJwt } from '../common/auth/jwt.util';
import { UsersRepository } from './users.repository';
import { PublicUser, toPublicUser } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Token sống 1 giờ. */
export const JWT_EXPIRES_IN_SECONDS = 60 * 60;

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  /** Số giây token còn hiệu lực. */
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  /** Hash giả để so sánh khi email không tồn tại (tránh lộ email qua thời gian phản hồi). */
  private dummyHash?: Promise<string>;

  constructor(private readonly usersRepository: UsersRepository) {}

  private get saltRounds(): number {
    const rounds = Number(process.env.BCRYPT_ROUNDS);
    return Number.isInteger(rounds) && rounds >= 4 && rounds <= 15
      ? rounds
      : 10;
  }

  /** POST /auth/register – băm mật khẩu bằng bcrypt rồi lưu. */
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
      throw new InternalServerErrorException(
        'Server chưa cấu hình JWT_SECRET',
      );
    }

    const user = await this.usersRepository.findByEmail(dto.email);
    // Luôn chạy bcrypt.compare dù không có user để thời gian phản hồi
    // không cho biết email có tồn tại hay không.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matched = await bcrypt.compare(dto.password, hash);
    if (!user || !matched) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // `sub` = id user, khớp với cách JwtAuthGuard đọc (request.user.id).
    const accessToken = signJwt(
      { sub: user.id, email: user.email, role: user.role },
      secret,
      JWT_EXPIRES_IN_SECONDS,
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN_SECONDS,
      user: toPublicUser(user),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= bcrypt.hash('dummy-password', this.saltRounds);
    return this.dummyHash;
  }
}
