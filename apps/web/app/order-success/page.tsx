'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || 'ORD-UNKNOWN';
  const transId = searchParams.get('transId') || 'TXN-MOCK';

  return (
    <div className="bg-white p-8 md:p-12 rounded-3xl border border-stone-200/80 shadow-xl max-w-md w-full text-center space-y-6">
      <div className="w-20 h-20 bg-emerald-50 text-[#006A32] rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner">
        ✓
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#006A32] bg-emerald-50 px-3 py-1 rounded-full">
          GIAO DỊCH THÀNH CÔNG
        </span>
        <h1 className="text-2xl font-black text-stone-900">Đặt Hàng Thành Công!</h1>
        <p className="text-xs text-stone-500">
          Cảm ơn bạn đã lựa chọn Phúc Long. Quầy bar đang chuẩn bị món nước cho bạn.
        </p>
      </div>

      <div className="bg-stone-50 rounded-2xl p-4 text-left space-y-2.5 border border-stone-200/60 text-xs">
        <div className="flex justify-between">
          <span className="text-stone-400">Mã đơn hàng:</span>
          <span className="font-extrabold text-stone-900">{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">Mã giao dịch:</span>
          <span className="font-semibold text-stone-700">{transId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-400">Trạng thái đơn:</span>
          <span className="font-bold text-emerald-600">ĐÃ THANH TOÁN (PAID)</span>
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="w-full bg-[#006A32] hover:bg-[#005227] text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-[#006A32]/25 active:scale-95 transition-all"
      >
        Tiếp tục đặt món
      </button>
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