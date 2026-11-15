'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchOrder, statusInfo, type ApiResult, type Order } from '@/lib/orders';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || 'ORD-UNKNOWN';
  const transId = searchParams.get('transId') || 'TXN-MOCK';

  // Trạng thái thật từ server — không còn hardcode "PAID" khi reload/trở lại trang.
  const [result, setResult] = useState<ApiResult<Order> | null>(null);

  useEffect(() => {
    if (!/^\d+$/.test(orderId)) return;
    let cancelled = false;
    void fetchOrder(orderId).then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const order = result?.ok ? result.data : null;
  const statusMeta = order ? statusInfo(order.status) : null;

  return (
    <div className="bg-white p-8 md:p-12 rounded-3xl border border-stone-200/80 shadow-xl max-w-md w-full text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-50 text-[#006A32] rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
        ✓
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#006A32] bg-emerald-50 px-3 py-1 rounded-full">
          {order?.status === 'PENDING'
            ? 'ĐÃ TẠO ĐƠN — ĐANG CHỜ THANH TOÁN'
            : 'GIAO DỊCH THÀNH CÔNG'}
        </span>
        <h1 className="text-2xl font-black text-stone-900">Đặt Hàng Thành Công!</h1>
        <p className="text-xs text-stone-500">
          Cảm ơn bạn đã lựa chọn Phúc Long. Quầy bar đang chuẩn bị món nước cho bạn.
        </p>
      </div>

      <div className="bg-stone-50 rounded-2xl p-4 text-left space-y-2.5 border border-stone-200/60 text-xs">
        <div className="flex justify-between">
          <span className="text-stone-400">Mã đơn hàng:</span>
          <span className="font-extrabold text-stone-900">{order?.code ?? orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">Mã giao dịch:</span>
          <span className="font-semibold text-stone-700">{transId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">Trạng thái đơn:</span>
          <span
            className={`font-bold ${
              order?.status === 'PENDING' ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {statusMeta ? statusMeta.label.toUpperCase() : 'ĐÃ THANH TOÁN (PAID)'}
          </span>
        </div>
      </div>

      {/* Task 9: xem trạng thái thật của đơn và lịch sử đơn */}
      {/^\d+$/.test(orderId) && (
        <button
          onClick={() => router.push(`/orders/${orderId}`)}
          className="w-full border border-[#006A32] text-[#006A32] hover:bg-emerald-50 py-3.5 rounded-2xl font-bold text-sm transition-all"
        >
          Xem chi tiết đơn #{orderId}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push('/orders')}
          className="w-full border border-stone-300 hover:bg-stone-50 py-3.5 rounded-2xl font-bold text-sm transition-all"
        >
          Lịch sử đơn
        </button>
        <button
          onClick={() => router.push('/')}
          className="w-full bg-[#006A32] hover:bg-[#005227] text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-[#006A32]/25 active:scale-95 transition-all"
        >
          Tiếp tục đặt món
        </button>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-6">
      <Suspense fallback={<div className="text-stone-500 font-bold">Đang tải...</div>}>
        <OrderSuccessContent />
      </Suspense>
    </div>
  );
}
