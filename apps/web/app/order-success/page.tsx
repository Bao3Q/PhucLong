'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderSuccessPage() {
  const router = useRouter();

  // Xóa giỏ hàng ngay khi người dùng hoàn tất thanh toán và tới trang này
  useEffect(() => {
    localStorage.removeItem('phuclong_cart');
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full rounded-3xl p-8 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-[#006A32] text-white rounded-full flex items-center justify-center text-2xl mx-auto shadow-lg shadow-[#006A32]/30">
          ✓
        </div>

        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-700">THANH TOÁN THÀNH CÔNG</span>
          <h1 className="text-3xl font-bold text-gray-900">Cảm ơn bạn!</h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Đơn hàng đã được gửi đến quầy pha chế. Chúng tôi sẽ chuẩn bị thật nhanh cho bạn.
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center text-sm font-semibold">
          <span className="text-gray-400 text-xs">Mã đơn hàng</span>
          <span className="text-gray-900 font-extrabold">#1042</span>
          <span className="bg-emerald-100 text-[#006A32] px-2.5 py-0.5 rounded-md text-xs font-bold">PAID</span>
        </div>

        <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400 relative px-4">
          <div className="text-center text-[#006A32]">
            <div className="w-5 h-5 bg-[#006A32] text-white rounded-full mx-auto flex items-center justify-center text-[8px] mb-1">✓</div>
            Pending
          </div>
          <div className="text-center text-[#006A32]">
            <div className="w-5 h-5 bg-[#006A32] text-white rounded-full mx-auto flex items-center justify-center text-[8px] mb-1">✓</div>
            Paid
          </div>
          <div className="text-center">
            <div className="w-5 h-5 bg-gray-200 rounded-full mx-auto mb-1"></div>
            Preparing
          </div>
          <div className="text-center">
            <div className="w-5 h-5 bg-gray-200 rounded-full mx-auto mb-1"></div>
            Ready
          </div>
        </div>

        <div className="bg-[#F4EBE1] p-4 rounded-2xl text-left flex items-center space-x-3">
          <span className="text-2xl">🛍️</span>
          <div className="text-xs">
            <h5 className="font-bold text-gray-900">Mời tới quầy lấy nước</h5>
            <p className="text-gray-600">Vui lòng đưa mã <span className="font-bold text-[#006A32]">#1042</span> cho nhân viên</p>
          </div>
        </div>

        <button 
          onClick={() => router.push('/')}
          className="w-full border border-gray-300 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-50 transition"
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}