import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { statusInfo } from '@/lib/orders';

// OrderHeader re-export SiteHeader (dùng next/link) — component test chỉ cần StatusBadge.
vi.mock('@/components/SiteHeader', () => ({ default: () => null }));

// WEB-T04: component nhãn trạng thái ở trang xác nhận đơn
describe('<StatusBadge />', () => {
  afterEach(() => cleanup());

  it('hiển thị nhãn và màu theo trạng thái đơn', async () => {
    const { StatusBadge } = await import('@/components/OrderHeader');
    const info = statusInfo('PAID');
    render(<StatusBadge label={info.label} className={info.className} />);
    const badge = screen.getByText('Đã thanh toán');
    expect(badge.className).toContain('bg-emerald-50');
  });
});
