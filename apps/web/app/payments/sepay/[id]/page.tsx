'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import {
  createSePayCheckout,
  fetchOrder,
  simulateSePay,
  type ApiResult,
  type SePayCheckout,
} from '@/lib/api';
import { formatVnd } from '@/lib/orders';

/** Hỏi lại trạng thái đơn mỗi 3 giây trong lúc chờ chuyển khoản. */
const POLL_EVERY_TICKS = 3;

type Phase = 'loading' | 'waiting' | 'expired' | 'paid' | 'error';

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Thanh toán SePay của một đơn (/payments/sepay/<mã đơn>). Trạng thái do backend quyết
 * định, trang chỉ hỏi lại:
 *  - POST /payments/sepay/checkout mở phiên hoặc lấy lại phiên đang chạy → F5/quay lại
 *    vẫn thấy đúng QR cũ, không cần lưu gì ở trình duyệt.
 *  - GET /orders/:id mỗi 3 giây: webhook SePay đưa đơn sang PAID.
 *  - Hết hạn: gọi lại checkout để backend chốt EXPIRED; "Thanh toán lại" gọi với restart.
 */
function SePayPaymentContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const validId = /^\d+$/.test(id);

  const [phase, setPhase] = useState<Phase>('loading');
  const [checkout, setCheckout] = useState<SePayCheckout | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // >0: khách đã bấm "Thanh toán lại"
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!validId) return;
    const orderId = Number(id);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const fail = (res: Extract<ApiResult<unknown>, { ok: false }>) => {
      if (res.kind === 'unauthenticated') {
        router.push(`/login?next=${encodeURIComponent(`/payments/sepay/${id}`)}`);
        return;
      }
      setError(res.message);
      setPhase('error');
    };

    let deadline: number;
    let ticks = 0;

    async function checkPayment(secondsRemaining: number): Promise<boolean> {
      const latest = await fetchOrder(id);
      if (cancelled) return false;
      if (latest.ok && latest.data.status === 'PAID') {
        setPhase('paid');
        return false;
      }
      if (secondsRemaining !== 0) return true;

      // Hết giờ trên trình duyệt: hỏi backend trước khi chốt hết hạn.
      const closed = await createSePayCheckout(orderId);
      if (cancelled) return false;
      if (!closed.ok) {
        fail(closed);
        return false;
      }
      if (closed.data.status === 'EXPIRED') {
        setCheckout(closed.data);
        setPhase('expired');
        return false;
      }

      deadline = Date.parse(closed.data.expiresAt); // Đồng hồ lệch: server vẫn còn hạn.
      return true;
    }

    async function tick() {
      if (cancelled) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);

      if (left === 0 || ticks % POLL_EVERY_TICKS === 0) {
        const keepPolling = await checkPayment(left);
        if (!keepPolling || cancelled) return;
      }

      ticks += 1;
      timer = setTimeout(tick, 1000);
    }

    async function openPaymentSession() {
      const order = await fetchOrder(id);
      if (cancelled) return;
      if (!order.ok) return fail(order);
      if (order.data.status === 'PAID') {
        setPhase('paid');
        return;
      }

      const first = await createSePayCheckout(orderId, attempt > 0);
      if (cancelled) return;
      if (!first.ok) return fail(first);
      setCheckout(first.data);
      if (first.data.status === 'EXPIRED') {
        setPhase('expired');
        return;
      }
      setError(null);
      setPhase('waiting');
      deadline = Date.parse(first.data.expiresAt);
      void tick();
    }

    void openPaymentSession();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, validId, attempt, router]);

  const retry = () => {
    setCheckout(null);
    setError(null);
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  // Demo local: SePay không gọi được localhost nên cần nút này để thấy luồng PAID.
  // Backend tự chặn endpoint này khi NODE_ENV=production.
  const simulate = async () => {
    setBusy(true);
    const res = await simulateSePay(id);
    setBusy(false);
    if (!res.ok) setError(res.message); // PAID sẽ được lần poll kế tiếp bắt
  };

  const card = 'bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center space-y-5';
  const primaryBtn =
    'w-full py-3 rounded-2xl font-bold text-white bg-[#006A32] hover:bg-[#005227] transition disabled:opacity-60';

  let content: React.ReactNode;
  if (!validId) {
    content = (
      <div role="alert" className={card}>
        <p className="text-sm text-red-700">Mã đơn hàng không hợp lệ.</p>
      </div>
    );
  } else if (phase === 'paid') {
    content = (
      <div className={card}>
        <div className="w-16 h-16 mx-auto bg-emerald-50 text-[#006A32] rounded-full flex items-center justify-center text-3xl">
          ✓
        </div>
        <h1 className="text-xl font-bold">Thanh toán thành công</h1>
        <p className="text-xs text-gray-500">SePay đã xác nhận giao dịch cho đơn hàng #{id}.</p>
        <button onClick={() => router.push(`/orders/${id}`)} className={primaryBtn}>
          Xem đơn hàng
        </button>
        <button onClick={() => router.push('/')} className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline">
          Tiếp tục đặt món
        </button>
      </div>
    );
  } else if (phase === 'expired') {
    content = (
      <div className={card}>
        <h1 className="text-xl font-bold text-red-700">Thanh toán thất bại</h1>
        <p role="alert" className="text-xs text-gray-600">
          Phiên thanh toán SePay của đơn hàng #{id} đã hết hạn. Đơn vẫn được giữ, hãy thanh toán lại để nhận mã QR mới.
        </p>
        <button onClick={retry} className={primaryBtn}>
          Thanh toán lại
        </button>
      </div>
    );
  } else if (phase === 'error') {
    content = (
      <div className={card}>
        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
          ⚠️ {error}
        </p>
        <button onClick={retry} className={primaryBtn}>
          Thử lại
        </button>
        <button onClick={() => router.push(`/orders/${id}`)} className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline">
          Xem đơn hàng
        </button>
      </div>
    );
  } else if (phase === 'loading' || !checkout) {
    content = (
      <div className={card} aria-busy="true">
        <div className="w-12 h-12 mx-auto border-4 border-[#006A32] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500">Đang tạo mã QR thanh toán…</p>
      </div>
    );
  } else {
    content = (
      <div className={card}>
        <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
          Thanh toán chuyển khoản qua SePay
        </span>
        <h1 className="text-xl font-bold">Quét mã QR để thanh toán đơn #{checkout.orderId}</h1>

        <div className="flex justify-center">
          <img
            src={checkout.qrUrl}
            alt={`Mã QR SePay cho đơn hàng ${checkout.orderId}`}
            className="w-56 h-56 rounded-2xl border border-gray-100 bg-white"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
            ⚠️ {error}
          </p>
        )}

        <div className="space-y-1 text-xs text-gray-500">
          <p className="text-2xl font-extrabold text-[#006A32]">{formatVnd(checkout.amount)}</p>
          <p>
            Ngân hàng: <strong className="text-gray-900">{checkout.bankCode}</strong> · STK:{' '}
            <strong className="text-gray-900">{checkout.accountNumber}</strong>
          </p>
          <p>
            Chủ tài khoản: <strong className="text-gray-900">{checkout.accountName}</strong>
          </p>
          <p>
            Nội dung chuyển khoản:{' '}
            <strong className="select-all text-gray-900">{checkout.transferDescription}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center space-x-2 bg-[#006A32]/5 border border-[#006A32]/20 rounded-full px-4 py-2">
            <span className="w-2 h-2 bg-[#006A32] rounded-full animate-pulse"></span>
            <span role="timer" className="text-xs font-bold text-[#006A32]">
              Đang chờ chuyển khoản — còn {formatCountdown(secondsLeft)}
            </span>
          </div>
          <p className="text-[11px] text-gray-400">
            Giữ nguyên số tiền và nội dung chuyển khoản. Trang tự cập nhật khi SePay xác nhận.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={simulate}
              disabled={busy}
              className="text-xs font-bold text-[#006A32] border border-[#006A32]/30 bg-[#006A32]/5 hover:bg-[#006A32]/10 rounded-full px-4 py-2 transition disabled:opacity-60"
            >
              ⚡ Mô phỏng chuyển khoản (demo local)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-10">{content}</main>
    </div>
  );
}

/** Route prerender với cacheComponents: `useParams` phải nằm trong <Suspense>. */
export default function SePayPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F6F2]">
          <SiteHeader />
          <main className="max-w-md mx-auto px-6 py-10 text-stone-500 font-bold">Đang tải...</main>
        </div>
      }
    >
      <SePayPaymentContent />
    </Suspense>
  );
}
