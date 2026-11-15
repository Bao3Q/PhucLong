'use client';

/** Header các trang đơn hàng — giờ delegate sang SiteHeader thống nhất. */
export { default } from './SiteHeader';

/** Nhãn trạng thái đơn có màu. */
export function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  );
}
