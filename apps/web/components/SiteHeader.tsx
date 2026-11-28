
'use client';

/**
 * Header thống nhất cho mọi trang.
 */
import Link from 'next/link';
import AuthNav from './AuthNav';
import { cartCount, cartTotal, useCart } from '@/lib/cart';
import { formatVnd } from '@/lib/orders';

export default function SiteHeader() {
  const { cart } = useCart();
  const count = cartCount(cart);
  const total = cartTotal(cart);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-stone-200/80 bg-white px-4 py-4 sm:px-6 lg:px-12">
      <Link href="/" className="flex shrink-0 items-center space-x-2">
        <span className="bg-[#006A32] text-white px-2.5 py-1 rounded-md font-bold text-sm">
          PL
        </span>
        <span className="font-bold tracking-wider text-stone-900">
          PHÚC LONG
        </span>
      </Link>

      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold sm:gap-x-5">
        <Link href="/" className="text-stone-600 hover:text-[#006A32] transition">
          Menu
        </Link>

        <Link href="/orders" className="text-stone-600 hover:text-[#006A32] transition">
          Lịch sử đơn
        </Link>

        {/* Voucher và điểm thưởng */}
        <Link href="/vouchers" className="text-stone-600 hover:text-[#006A32] transition">
          Ưu đãi
        </Link>

        <Link href="/rewards" className="text-stone-600 hover:text-[#006A32] transition">
          Điểm thưởng
        </Link>

        <AuthNav />

        <Link
          href="/checkout"
          className="flex items-center gap-2 bg-[#006A32] text-white rounded-full pl-3 pr-1.5 py-1.5 hover:bg-[#005227] transition"
          aria-label={`Giỏ hàng, ${count} món`}
        >
          <span className="text-xs font-bold">🛒 Giỏ hàng</span>
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
              count > 0
                ? 'bg-white text-[#006A32]'
                : 'bg-white/25 text-white/90'
            }`}
          >
            {count}
          </span>

          {count > 0 && (
            <span className="hidden md:inline text-xs font-bold pr-1">
              {formatVnd(total)}
            </span>
          )}
        </Link>
      </nav>
    </header>
  );
}
