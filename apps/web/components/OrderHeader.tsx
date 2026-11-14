'use client';

import { useRouter } from 'next/navigation';

/** Header gọn cho các trang đơn hàng (Task 9): logo về menu + link lịch sử đơn. */
export default function OrderHeader() {
  const router = useRouter();
  return (
    <header className="bg-white border-b border-stone-200/80 px-6 lg:px-12 py-4 flex justify-between items-center">
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
        <span className="bg-[#006A32] text-white px-2.5 py-1 rounded-md font-bold text-sm">PL</span>
        <span className="font-bold tracking-wider text-stone-900">PHÚC LONG</span>
      </div>
      <nav className="flex items-center gap-5 text-sm font-semibold">
        <button onClick={() => router.push('/orders')} className="cursor-pointer text-stone-600 hover:text-[#006A32] transition">
          Lịch sử đơn
        </button>
        <button onClick={() => router.push('/')} className="cursor-pointer text-[#006A32] hover:text-[#005227] transition">
          ← Menu
        </button>
      </nav>
    </header>
  );
}

/** Nhãn trạng thái đơn có màu. */
export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  );
}
