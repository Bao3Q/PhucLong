/** Lưu / đọc JWT ở trình duyệt (trang /login lưu token, trang thanh toán dùng token). */
export const TOKEN_KEY = 'accessToken';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư…) – bỏ qua.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // bỏ qua
  }
}

/** Chỉ cho phép chuyển hướng nội bộ (tránh ?next=https://trang-la.com). */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
