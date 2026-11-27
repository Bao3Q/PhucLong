'use client';

import { useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';

interface Promotion {
  id: number;
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  endsAt?: string | null;
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/promotions/available')
      .then((res) => res.json())
      .then((data) => setVouchers(data))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    alert('Đã sao chép mã voucher!');
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-10">

        <h1 className="text-3xl font-extrabold text-[#006A32]">
          Ưu đãi dành cho bạn
        </h1>

        <p className="text-sm text-gray-500 mt-2">
          Khám phá các chương trình khuyến mãi của Phúc Long.
        </p>

        {loading ? (
          <p className="py-10">Đang tải voucher...</p>
        ) : vouchers.length === 0 ? (
          <p className="py-10 text-gray-500">
            Hiện chưa có voucher nào.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">

            {vouchers.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm"
              >
                <p className="text-xs font-bold text-[#8b6b37]">
                  PHÚC LONG REWARDS
                </p>

                <h2 className="text-xl font-bold text-[#006A32] mt-3">
                  {item.name}
                </h2>

                <p className="text-sm text-gray-500 mt-2">
                  {item.description}
                </p>

                <p className="text-2xl font-extrabold mt-4">
                  {item.discountType === 'PERCENT'
                    ? `Giảm ${item.discountValue}%`
                    : `Giảm ${item.discountValue.toLocaleString('vi-VN')}đ`}
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  Đơn tối thiểu:{' '}
                  {item.minOrderAmount.toLocaleString('vi-VN')}đ
                </p>

                {item.maxDiscountAmount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Giảm tối đa:{' '}
                    {item.maxDiscountAmount.toLocaleString('vi-VN')}đ
                  </p>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  Hết hạn:{' '}
                  {item.endsAt
                    ? new Date(item.endsAt).toLocaleDateString('vi-VN')
                    : 'Không giới hạn'}
                </p>

                <div className="flex items-center justify-between mt-5 border-t pt-4">
                  <strong className="text-[#006A32]">
                    {item.code}
                  </strong>

                  <button
                    onClick={() => void copyCode(item.code)}
                    className="bg-[#006A32] text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            ))}

          </div>
        )}
      </main>
    </div>
  );
}