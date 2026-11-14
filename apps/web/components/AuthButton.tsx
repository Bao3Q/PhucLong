'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getToken } from '@/lib/auth';

/**
 * Nút Đăng nhập / Đăng xuất ở header.
 * Token nằm trong localStorage nên chỉ đọc được phía client:
 * render rỗng tới khi đọc xong để tránh lệch hydration.
 */
export default function AuthButton() {
  const router = useRouter();
  // null = chưa đọc token xong, true/false = trạng thái đăng nhập
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, []);

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
    router.refresh();
  }

  if (loggedIn === null) return null;

  if (loggedIn) {
    return (
      <button
        onClick={handleLogout}
        className="cursor-pointer text-stone-600 hover:text-[#006A32] transition"
      >
        Đăng xuất
      </button>
    );
  }

  return (
    <button
      onClick={() => router.push('/login')}
      className="cursor-pointer text-[#006A32] font-bold hover:text-[#005227] transition"
    >
      Đăng nhập
    </button>
  );
}
