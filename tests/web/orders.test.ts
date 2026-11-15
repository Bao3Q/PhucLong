import { describe, expect, it } from 'vitest';
import { STATUS_INFO, formatDateTime, formatVnd, statusInfo } from '@/lib/orders';

// WEB-T01: nhãn trạng thái và định dạng tiền/giờ dùng ở trang xác nhận & lịch sử đơn
describe('lib/orders – hiển thị đơn hàng', () => {
  it('mỗi trạng thái của máy trạng thái đơn đều có nhãn tiếng Việt', () => {
    expect(Object.keys(STATUS_INFO).sort()).toEqual(
      ['CANCELLED', 'COMPLETED', 'PAID', 'PAYMENT_FAILED', 'PENDING', 'PREPARING', 'READY'],
    );
    expect(statusInfo('PAID').label).toBe('Đã thanh toán');
    expect(statusInfo('PENDING').label).toBe('Chờ thanh toán');
  });

  it('trạng thái lạ vẫn hiển thị được, không làm vỡ giao diện', () => {
    expect(statusInfo('UNKNOWN').label).toBe('UNKNOWN');
  });

  it('định dạng tiền theo kiểu Việt Nam', () => {
    expect(formatVnd(45000)).toBe(`${(45000).toLocaleString('vi-VN')}đ`);
    expect(formatVnd(0)).toBe('0đ');
  });

  it('giờ không hợp lệ thì trả nguyên chuỗi', () => {
    expect(formatDateTime('khong-phai-ngay')).toBe('khong-phai-ngay');
    expect(formatDateTime('2026-11-15T07:00:00.000Z')).toContain('2026');
  });
});
