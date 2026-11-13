'use client';

import React, { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath, setToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Mode = 'login' | 'register';

/** Lấy thông báo lỗi từ backend (message có thể là chuỗi hoặc mảng). */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    return typeof msg === 'string' ? msg : fallback;
  } catch {
    return fallback;
  }
}

function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === 'login';

  async function post(path: string) {
    return fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isLogin) {
        const reg = await post('/auth/register');
        if (!reg.ok) {
          setError(
            reg.status === 409
              ? 'Email này đã được đăng ký. Hãy đăng nhập.'
              : await errorMessage(reg, 'Đăng ký thất bại'),
          );
          return;
        }
      }
      const res = await post('/auth/login');
      if (!res.ok) {
        setError(await errorMessage(res, 'Đăng nhập thất bại'));
        return;
      }
      const data = await res.json();
      setToken(data.accessToken);
      router.push(next);
    } catch {
      setError('Không kết nối được máy chủ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#006A32] focus:ring-2 focus:ring-green-100';

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-full py-2 transition-colors ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {m === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        ))}
      </div>

      <h1 className="mt-6 text-2xl font-bold text-gray-900">
        {isLogin ? 'Chào bạn quay lại' : 'Tạo tài khoản Phúc Long'}
      </h1>
      <p className="mt-1 text-xs text-gray-500">
        {next.startsWith('/checkout')
          ? 'Đăng nhập để đặt đơn. Giỏ hàng của bạn vẫn được giữ nguyên.'
          : 'Chỉ cần email và mật khẩu từ 8 đến 72 ký tự.'}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="ban@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Mật khẩu
          <input
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            maxLength={72}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-[#006A32] py-3 text-sm font-semibold text-white hover:bg-[#005a2a] disabled:opacity-60"
        >
          {busy ? 'Đang xử lý…' : isLogin ? 'Đăng nhập' : 'Tạo tài khoản và đăng nhập'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
          <span className="bg-[#006A32] text-white px-2.5 py-1 rounded-md font-bold text-sm">PL</span>
          <span className="font-bold tracking-wider text-gray-900">PHÚC LONG</span>
        </div>
        <button onClick={() => router.push('/')} className="text-sm font-semibold text-[#006A32]">
          ← Quay lại menu
        </button>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-10">
        {/* useSearchParams cần Suspense khi build production */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
