import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { User, UserRole } from './entities/user.entity';

/**
 * Kho lưu user trong bộ nhớ (cùng kiểu với ProductsService hiện tại).
 * Khi chuyển sang PostgreSQL chỉ cần thay phần cài đặt bên trong,
 * giữ nguyên các phương thức create / findByEmail / findById.
 */
@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

  /** Trả về undefined nếu email đã tồn tại (không phân biệt hoa/thường). */
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

  /** Dùng trong test. */
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}
