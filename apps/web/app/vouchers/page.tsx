'use client';

import { useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { formatVnd } from '@/lib/orders';

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
  const [copyStatus, setCopyStatus] = useState<{ code: string; copied: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/promotions/available')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load vouchers');
        return res.json();
      })
      .then((data) => setVouchers(data))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus({ code, copied: true });
    } catch {
      setCopyStatus({ code, copied: false });
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-stone-900">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-[radial-gradient(ellipse_at_top_right,#277447,transparent_60%)] bg-[#06482c] px-6 py-9 text-white sm:px-12 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Ưu đãi dành cho bạn
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-50 sm:text-base">
            Sao chép mã ưu đãi và sử dụng khi thanh toán đơn hàng Phúc Long.
          </p>
        </section>

        {loading ? (
          <p className="py-8 text-sm text-stone-600" role="status">Đang tải voucher...</p>
        ) : vouchers.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-stone-200 bg-white px-6 py-8 text-center text-sm text-stone-600" role="status">
            Hiện chưa có voucher nào.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {vouchers.map((item) => {
              const discount = item.discountType === 'PERCENT'
                ? `${item.discountValue}%`
                : formatVnd(item.discountValue);
              const summary = `${item.name} ${item.description ?? ''}`;
              const amounts = summary.match(/\d+(?:[.,]\d+)*\s*[%đ₫]/gi) ?? [];
              const showsDiscount = amounts.some((amount) =>
                amount.replace(/\s/g, '').toLowerCase().replace('₫', 'đ') === discount,
              );
              const status = copyStatus?.code === item.code ? copyStatus : null;

              return (
                <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#dce7dd] bg-white shadow-sm">
                  <div className="flex-1 border-t-4 border-[#006a32] p-5 sm:p-6">
                    <h2 className="text-xl leading-snug font-bold text-[#06482c] [overflow-wrap:anywhere]">
                      {item.name}
                    </h2>
                    {item.description && (
                      <p className="mt-2 text-sm leading-relaxed text-stone-600 [overflow-wrap:anywhere]">
                        {item.description}
                      </p>
                    )}

                    <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 rounded-xl bg-[#f3f6f1] px-4 py-3 text-sm text-stone-600 [&>dd]:text-right [&>dd]:font-semibold [&>dd]:text-stone-900">
                      {!showsDiscount && (
                        <>
                          <dt>Mức giảm</dt>
                          <dd>{discount}</dd>
                        </>
                      )}
                      <dt>Đơn tối thiểu</dt>
                      <dd>{formatVnd(item.minOrderAmount)}</dd>
                      {item.maxDiscountAmount != null && (
                        <>
                          <dt>Giảm tối đa</dt>
                          <dd>{formatVnd(item.maxDiscountAmount)}</dd>
                        </>
                      )}
                      <dt>Hạn dùng</dt>
                      <dd>{item.endsAt ? new Date(item.endsAt).toLocaleDateString('vi-VN') : 'Không giới hạn'}</dd>
                    </dl>
                  </div>

                  <div className="border-t border-dashed border-[#acc4b1] bg-[#f5faf5] px-5 py-4 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-600">Mã ưu đãi</p>
                        <strong className="mt-0.5 block font-mono text-base text-[#06482c] [overflow-wrap:anywhere]">
                          {item.code}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyCode(item.code)}
                        aria-label={`Sao chép mã ${item.code}`}
                        className="min-h-11 shrink-0 cursor-pointer rounded-xl bg-[#006a32] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#005227] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006a32]"
                      >
                        {status?.copied ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                    </div>
                    <p role="status" className={status && !status.copied ? 'mt-2 text-xs text-red-800' : 'sr-only'}>
                      {status && (status.copied ? `Đã sao chép mã ${item.code}.` : 'Không thể sao chép tự động. Bạn có thể chọn và sao chép mã ưu đãi.')}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
