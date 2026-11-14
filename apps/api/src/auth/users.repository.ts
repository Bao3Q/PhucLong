import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Kho user dùng Prisma/PostgreSQL khi có kết nối, tự chuyển sang lưu trong
 * bộ nhớ (Map) khi không có PrismaService (unit test, NODE_ENV=test).
 * Interface create / findByEmail / findById giữ nguyên cho cả hai nhánh.
 *
 * Tài khoản ADMIN mặc định cho nhánh in-memory (DB được seed bằng migration
 * `seed_admin_user`):
 *   email    : admin@phuclong.vn
 *   mật khẩu : Admin@123456
 */
const DEFAULT_ADMIN = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@phuclong.vn',
  passwordHash:
    '$2b$10$6QjZRCXeZIk1rYpQaxbQfOZK4p.6T.DVVbWFXSFikJEgA.nMLrP56',
};

@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

  constructor(
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService | null,
  ) {
    // Chỉ seed admin trong bộ nhớ khi không có DB (test/demo không cần PostgreSQL).
    if (!this.prisma) {
      this.seedAdmin();
    }
  }

  private seedAdmin(): void {
    const admin: User = {
      ...DEFAULT_ADMIN,
      role: 'ADMIN',
      loyaltyPoints: 0,
      createdAt: new Date(),
    };
    this.users.set(admin.id, admin);
    this.emailIndex.set(admin.email, admin.id);
  }

  async create(
    email: string,
    passwordHash: string,
    role: UserRole = 'CUSTOMER',
  ): Promise<User | undefined> {
    const key = email.toLowerCase();
    if (this.prisma) {
      try {
        return await this.prisma.user.create({
          data: { email: key, passwordHash, role },
        });
      } catch (error) {
        // Trùng email (unique constraint) → báo về như nhánh in-memory.
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          return undefined;
        }
        throw error;
      }
    }
    if (this.emailIndex.has(key)) return undefined;

    const user: User = {
      id: randomUUID(),
      email: key,
      passwordHash,
      role,
      loyaltyPoints: 0,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.emailIndex.set(key, user.id);
    return { ...user };
  }

  async findByEmail(email: string): Promise<User | undefined> {
    if (this.prisma) {
      return (await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })) ?? undefined;
    }
    const id = this.emailIndex.get(email.toLowerCase());
    const user = id ? this.users.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    if (this.prisma) {
      return (await this.prisma.user.findUnique({ where: { id } })) ?? undefined;
    }
    const user = this.users.get(id);
    return user ? { ...user } : undefined;
  }

  /** Dùng trong test: xóa hết rồi tạo lại admin mặc định. */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
    this.seedAdmin();
  }
}
