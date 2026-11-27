'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { fetchLoyaltyHistory, fetchLoyaltyPoints, type LoyaltyTransaction } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { formatDateTime, formatVnd } from '@/lib/orders';

const typeLabel: Record<LoyaltyTransaction['type'], string> = {
  EARN: 'Tích điểm', REDEEM: 'Đổi điểm', ADJUST: 'Điều chỉnh', EXPIRE: 'Điểm hết hạn',
};

export default function RewardsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/login?next=/rewards'); return; }
    void Promise.all([fetchLoyaltyPoints(), fetchLoyaltyHistory()]).then(([points, transactions]) => {
      if (points.ok) setBalance(points.data.loyaltyPoints);
      else setError(points.message);
      if (transactions.ok) setHistory(transactions.data);
      else setError(transactions.message);
      setLoading(false);
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8b6b37]">Phúc Long Rewards</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[#174b32]">Điểm thưởng của tôi</h1>
          <p className="mt-2 text-sm text-stone-500">Tích điểm từ mỗi đơn hàng và đổi điểm để nhận ưu đãi.</p>
        </div>
        <section className="rounded-3xl bg-gradient-to-br from-[#006A32] to-[#174b32] p-7 text-white shadow-lg">
          <p className="text-sm text-white/75">Số dư điểm hiện tại</p>
          <p className="mt-2 text-5xl font-black">{balance.toLocaleString('vi-VN')} <span className="text-xl">điểm</span></p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">Quy tắc tích điểm</p><p className="mt-1 font-bold">10.000đ = 1 điểm</p></div>
            <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">Quy tắc đổi điểm</p><p className="mt-1 font-bold">1 điểm = 1.000đ</p></div>
          </div>
          <p className="mt-4 text-xs text-white/70">Khi thanh toán, bạn có thể sử dụng điểm tối đa bằng 20% giá trị đơn sau voucher.</p>
        </section>
        <section className="mt-8 rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-stone-800">Lịch sử giao dịch điểm</h2>
          {loading ? <p className="py-8 text-center text-sm text-stone-400">Đang tải dữ liệu...</p> : error ? <p className="py-8 text-center text-sm text-red-600">{error}</p> : history.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">Bạn chưa có giao dịch điểm nào.</p> : (
            <div className="mt-4 divide-y divide-stone-100">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0"><p className="font-semibold text-stone-800">{typeLabel[item.type]}</p><p className="mt-1 truncate text-xs text-stone-400">{item.description || (item.orderId ? `Đơn hàng #${item.orderId}` : 'Giao dịch điểm')} · {formatDateTime(item.createdAt)}</p><p className="mt-1 text-xs text-stone-500">Số dư sau giao dịch: {item.balanceAfter.toLocaleString('vi-VN')} điểm</p></div>
                  <p className={`shrink-0 font-bold ${item.points >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{item.points > 0 ? '+' : ''}{item.points} điểm</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-stone-400">Giá trị quy đổi hiện tại: {formatVnd(balance * 1000)} nếu sử dụng toàn bộ điểm (tùy giới hạn từng đơn).</p>
        </section>
      </main>
    </div>
  );
}
