export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  /** Mật khẩu đã băm bằng bcrypt – KHÔNG bao giờ trả ra ngoài API. */
  passwordHash: string;
  role: UserRole;
  loyaltyPoints: number;
  createdAt: Date;
}

/** Thông tin user an toàn để trả về cho client (không có passwordHash). */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  loyaltyPoints: number;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    loyaltyPoints: user.loyaltyPoints,
  };
}
