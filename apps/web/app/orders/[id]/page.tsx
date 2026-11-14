'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import OrderHeader, { StatusBadge } from '@/components/OrderHeader';
import { fetchOrder, formatDateTime, formatVnd, statusInfo, type ApiResult, type Order } from '@/lib/orders';

/** Đơn còn chờ thanh toán thì hỏi lại máy chủ mỗi 3 giây, tối đa 20 lần (~1 phút). */
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

/** Task 9 – Màn hình xác nhận đơn: GET /orders/:id (mã đơn, trạng thái, món, tổng tiền). */
export default function OrderConfirmationPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [result, setResult] = useState<ApiResult<Order> | null>(null); // null = đang tải
  const [polls, setPolls] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // Tải đơn; nếu vẫn PENDING thì hẹn giờ tải lại cho tới khi đổi trạng thái hoặc hết lượt.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = (count: number) => {
      fetchOrder(id).then((res) => {
        if (cancelled) return;
        setResult(res);
        setPolls(count);
        if (res.ok && res.data.status === 'PENDING' && count < MAX_POLLS) {
          timer = setTimeout(() => load(count + 1), POLL_INTERVAL_MS);
        }
      });
    };
    load(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, reloadKey]);

  function retry() {
    setResult(null);
    setReloadKey((k) => k + 1);
  }

  let content: ReactNode;
  if (result === null) {
    content = <div className="h-72 rounded-3xl bg-stone-200/60 animate-pulse" aria-busy="true" />;
  } else if (!result.ok) {
    const needLogin = result.kind === 'unauthenticated';
    content = (
      <div role="alert" className="bg-white rounded-3xl border border-stone-200 p-8 text-center space-y-4">
        <p className="text-stone-700 font-semibold">{result.message}</p>
        <div className="flex justify-center gap-3">
          {needLogin ? (
            <button
              onClick={() => router.push(`/login?next=${encodeURIComponent(`/orders/${id}`)}`)}
              className="bg-[#006A32] hover:bg-[#005227] text-white px-6 py-3 rounded-xl font-bold text-sm"
            >
              Đăng nhập
            </button>
          ) : (
            <>
              {(result.kind === 'network' || result.kind === 'server') && (
                <button onClick={retry} className="bg-[#006A32] text-white px-6 py-3 rounded-xl font-bold text-sm">
                  Thử lại
                </button>
              )}
              <button onClick={() => router.push('/orders')} className="px-6 py-3 rounded-xl font-bold text-sm border border-stone-300">
                Lịch sử đơn
              </button>
            </>
          )}
        </div>
      </div>
    );
  } else {
    const order = result.data;
    const info = statusInfo(order.status);
    const waiting = order.status === 'PENDING';
    content = (
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xl overflow-hidden">
        <div className="p-8 text-center space-y-3 border-b border-dashed border-stone-200">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Mã đơn của bạn</p>
          <p className="text-5xl font-black text-[#006A32] tracking-tight">{order.code}</p>
          <StatusBadge label={info.label} className={info.className} />
          <p className="text-xs text-stone-500">Đặt lúc {formatDateTime(order.createdAt)}</p>
          {waiting && polls < MAX_POLLS && (
            <p className="text-xs text-amber-700" aria-live="polite">Đang chờ xác nhận thanh toán, trang tự cập nhật…</p>
          )}
          {waiting && polls >= MAX_POLLS && (
            <button onClick={retry} className="text-xs font-bold text-[#006A32] underline">
              Kiểm tra lại trạng thái
            </button>
          )}
        </div>

        <ul className="p-6 space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-bold text-stone-900">
                  {item.qty}× {item.productName}
                </p>
                <p className="text-xs text-stone-500">
                  Size {item.size}
                  {item.toppings.length > 0 && ` · ${item.toppings.join(', ')}`}
                  {item.note && ` · Ghi chú: ${item.note}`}
                </p>
              </div>
              <span className="font-semibold text-stone-700 whitespace-nowrap">{formatVnd(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="px-6 pb-6 space-y-1.5 text-sm">
          {!!order.discountAmount && order.discountAmount > 0 && (
            <>
              <div className="flex justify-between text-stone-500">
                <span>Tạm tính</span>
                <span>{formatVnd(order.subtotal ?? order.total)}</span>
              </div>
              <div className="flex justify-between text-stone-500">
                <span>Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ''}</span>
                <span>−{formatVnd(order.discountAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline pt-2 border-t border-stone-100">
            <span className="font-bold text-stone-900">Tổng cộng</span>
            <span className="text-xl font-black text-[#006A32]">{formatVnd(order.total)}</span>
          </div>
        </div>

        <div className="p-6 pt-0 grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/orders')} className="py-3 rounded-2xl font-bold text-sm border border-stone-300 hover:bg-stone-50">
            Lịch sử đơn
          </button>
          <button onClick={() => router.push('/')} className="py-3 rounded-2xl font-bold text-sm bg-[#006A32] hover:bg-[#005227] text-white">
            Tiếp tục đặt món
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <OrderHeader />
      <main className="max-w-md mx-auto px-6 py-8">{content}</main>
    </div>
  );
}
