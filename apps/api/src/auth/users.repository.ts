import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';

/**
 * Kho user lưu trong bộ nhớ (Phúc Long chưa nối database, giống ProductsService).
 * Khi có PostgreSQL chỉ cần thay phần bên trong, giữ nguyên create / findByEmail / findById.
 *
 * Tài khoản ADMIN mặc định lấy từ prisma/schema.sql của nhóm:
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

  constructor() {
    this.seedAdmin();
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
    const id = this.emailIndex.get(email.toLowerCase());
    const user = id ? this.users.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
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
