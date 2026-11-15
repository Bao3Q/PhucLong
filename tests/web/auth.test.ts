import { afterEach, describe, expect, it } from 'vitest';
import { clearToken, getToken, safeNextPath, setToken } from '@/lib/auth';

// WEB-T03: lưu token JWT và chặn chuyển hướng ra trang ngoài sau khi đăng nhập
describe('lib/auth', () => {
  afterEach(() => clearToken());

  it('lưu, đọc và xoá token', () => {
    expect(getToken()).toBeNull();
    setToken('abc.def.ghi');
    expect(getToken()).toBe('abc.def.ghi');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('chỉ cho phép ?next là đường dẫn nội bộ', () => {
    expect(safeNextPath('/checkout')).toBe('/checkout');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });
});
