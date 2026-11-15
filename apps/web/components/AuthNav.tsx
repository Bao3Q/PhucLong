'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, subscribeToken } from '@/lib/auth';

/** Đọc trạng thái đăng nhập, an toàn khi render phía server (luôn "chưa đăng nhập"). */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(
    subscribeToken, // subscribe (event + storage → cả tab khác)
    () => typeof window !== 'undefined' && window.localStorage.getItem('accessToken') !== null,
    () => false, // server snapshot
  );
}

/** Đăng nhập / Đăng xuất — tự cập nhật realtime nhờ subscribeToken. */
export default function AuthNav() {
  const loggedIn = useIsLoggedIn();
  const router = useRouter();

  if (loggedIn) {
    return (
      <button
        onClick={() => {
          clearToken();
          router.push('/');
        }}
        className="cursor-pointer text-sm font-semibold text-stone-600 hover:text-[#006A32] transition"
      >
        Đăng xuất
      </button>
    );
  }
  return (
    <button
      onClick={() => router.push('/login')}
      className="cursor-pointer text-sm font-semibold text-[#006A32] hover:text-[#005227] transition"
    >
      Đăng nhập
    </button>
  );
}
