'use client';

import React, { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { login, register } from '@/lib/api';
import { safeNextPath, setToken } from '@/lib/auth';

type Mode = 'login' | 'register';

function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLogin = mode === 'login';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isLogin) {
        const reg = await register(email, password);
        if (!reg.ok) {
          setError(
            reg.kind === 'conflict'
              ? 'Email này đã được đăng ký. Hãy đăng nhập.'
              : reg.message,
          );
          return;
        }
      }
      const res = await login(email, password);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setToken(res.data.accessToken);
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
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        {/* useSearchParams cần Suspense khi build production */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
