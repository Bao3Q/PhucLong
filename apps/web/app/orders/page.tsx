'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import OrderHeader, { StatusBadge } from '@/components/OrderHeader';
import { fetchMyOrders, formatDateTime, formatVnd, statusInfo, type ApiResult, type Order } from '@/lib/orders';

/** Task 9 – Lịch sử đơn: GET /orders/me, mới nhất trước, bấm để xem chi tiết. */
export default function OrderHistoryPage() {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult<Order[]> | null>(null); // null = đang tải
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false; // rời trang trước khi có kết quả thì bỏ qua
    fetchMyOrders().then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setResult(null);
    setReloadKey((k) => k + 1);
  }

  let content: ReactNode;
  if (result === null) {
    content = (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-stone-200/60 animate-pulse" />
        ))}
      </div>
    );
  } else if (!result.ok && result.kind === 'unauthenticated') {
    content = (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4">
        <p className="text-stone-700 font-semibold">{result.message}</p>
        <button
          onClick={() => router.push('/login?next=/orders')}
          className="bg-[#006A32] hover:bg-[#005227] text-white px-6 py-3 rounded-xl font-bold text-sm"
        >
          Đăng nhập
        </button>
      </div>
    );
  } else if (!result.ok) {
    content = (
      <div role="alert" className="bg-red-50 rounded-2xl border border-red-200 p-6 text-center space-y-3">
        <p className="text-red-700 font-semibold">{result.message}</p>
        <button onClick={retry} className="text-sm font-bold text-[#006A32] underline">
          Thử lại
        </button>
      </div>
    );
  } else if (result.data.length === 0) {
    content = (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-4">
        <p className="text-stone-600">Bạn chưa có đơn hàng nào.</p>
        <button
          onClick={() => router.push('/')}
          className="bg-[#006A32] hover:bg-[#005227] text-white px-6 py-3 rounded-xl font-bold text-sm"
        >
          Đặt món ngay
        </button>
      </div>
    );
  } else {
    content = (
      <ul className="space-y-3">
        {result.data.map((order) => {
          const info = statusInfo(order.status);
          return (
            <li key={order.id}>
              <button
                onClick={() => router.push(`/orders/${order.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-stone-200 hover:border-[#006A32]/50 hover:shadow-md transition p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-stone-900 text-lg">{order.code}</span>
                    <StatusBadge label={info.label} className={info.className} />
                  </div>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(order.createdAt)} · {order.itemCount} món
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-[#006A32]">{formatVnd(order.total)}</p>
                  <p className="text-xs text-stone-400">Xem chi tiết →</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      <OrderHeader />
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Lịch sử đơn hàng</h1>
          <p className="text-sm text-stone-500">Các đơn bạn đã đặt, mới nhất ở trên cùng.</p>
        </div>
        {content}
      </main>
    </div>
  );
}
