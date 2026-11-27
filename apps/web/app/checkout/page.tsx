'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import {
  createOrder,
  createSePayCheckout,
  payOrder,
  validateVoucher,
  fetchLoyaltyPoints,
  type ApiResult,
  type VoucherValidation,
  type LoyaltyPoints,
} from '@/lib/api';
import { cartTotal, toOrderItems, useCart } from '@/lib/cart';
import { formatVnd } from '@/lib/orders';
import { getToken } from '@/lib/auth';

type PaymentMethod = 'momo' | 'card' | 'sepay';

const PAYMENT_METHODS: {
  id: PaymentMethod;
  title: string;
  hint: string;
  icon: string;
  iconBg: string;
}[] = [
  { id: 'sepay', title: 'Chuyển khoản ngân hàng', hint: 'SePay — quét QR, tự xác nhận trong 2 phút', icon: '₫', iconBg: 'bg-[#006A32]' },
  { id: 'momo', title: 'Ví điện tử', hint: 'MoMo / ZaloPay', icon: 'M', iconBg: 'bg-pink-600' },
  { id: 'card', title: 'Thẻ ngân hàng', hint: 'Visa / Mastercard / Napas', icon: '💳', iconBg: 'bg-blue-600' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepay');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voucher: nhập mã → validate trước (server) → áp vào tổng hiển thị và
  // gửi kèm khi tạo đơn (server tính lại, không tin số tiền client).
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState<VoucherValidation | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyPoints | null>(null);
  const [pointsInput, setPointsInput] = useState('0');
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  // Giỏ đổi → subtotal đổi nên voucher đã áp không còn đúng.
  useEffect(() => {
    setVoucher(null);
    setVoucherError(null);
  }, [cart]);

  useEffect(() => {
    if (!getToken()) return;

    fetchLoyaltyPoints().then((res) => {
      if (res.ok) {
        setLoyalty(res.data);
      }
    });
  }, []);

  const applyVoucher = async () => {
    const code = voucherInput.trim();
    if (!code || cart.length === 0) return;
    setValidatingVoucher(true);
    setVoucherError(null);
    const res = await validateVoucher(code, cartTotal(cart));
    if (res.ok) {
      setVoucher(res.data);
      setVoucherInput(res.data.code);
    } else if (res.kind === 'unauthenticated') {
      // Xem voucher cũng cần đăng nhập (khớp với đặt đơn) → sang /login rồi quay lại.
      router.push('/login?next=/checkout');
    } else {
      setVoucher(null);
      setVoucherError(res.message);
    }
    setValidatingVoucher(false);
  };

  // next.config bật cacheComponents: rời /checkout chỉ ẩn trang (React Activity), state cũ
  // vẫn còn khi quay lại. Trả về ban đầu khi trang bị ẩn/gỡ để lần vào sau bắt đầu sạch
  // (nếu không, isSubmitting còn true và màn hình kẹt ở "Đang xử lý thanh toán…").
  useEffect(
    () => () => {
      setIsSubmitting(false);
      setErrorMessage(null);
    },
    [],
  );

  const totalCartPrice = cartTotal(cart);

  const discountAmount =
    voucher?.discountAmount ?? 0;

  const afterVoucher = Math.max(
    0,
    totalCartPrice - discountAmount
  );

  const requestedPoints = Math.max(
    0,
    Math.floor(Number(pointsInput) || 0)
  );

  const maxPoints = Math.floor(
    afterVoucher * 0.2 / 1000
  );

  const pointsToRedeem = Math.min(
    requestedPoints,
    loyalty?.loyaltyPoints ?? 0,
    maxPoints
  );

  const loyaltyDiscount =
    pointsToRedeem * 1000;

  const finalTotal = Math.max(
    0,
    afterVoucher - loyaltyDiscount
  );

  const handleRemoveItem = (index: number) => {
    setCart((current) => current.filter((_, i) => i !== index));
  };

  function goToLogin() {
    router.push('/login?next=/checkout');
  }

  /** Lấy data từ kết quả API: 401 → sang /login (trả null), lỗi khác → throw message. */
  function unwrap<T>(res: ApiResult<T>): T | null {
    if (res.ok) return res.data;
    if (res.kind === 'unauthenticated') {
      goToLogin();
      return null;
    }
    throw new Error(res.message);
  }

  /** Giỏ đã được chốt vào đơn → dọn giỏ, mọi bước sau dựa trên đơn chứ không dựa vào giỏ. */
  function clearCart() {
    setCart([]);
    setVoucher(null);
    setVoucherInput('');
  }

  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

    // Đặt đơn cần đăng nhập: chưa có token thì chuyển sang /login rồi quay lại đây.
    if (!getToken()) {
      goToLogin();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Client KHÔNG gửi giá: server tra bảng giá và tự tính unitPrice/total,
      // kèm voucherCode (nếu đã áp) để server xác nhận lần cuối.
      const orderData = unwrap(await createOrder(toOrderItems(cart), voucher?.code,pointsToRedeem));
      if (!orderData) return;

      if (paymentMethod === 'sepay') {
        // Mở phiên QR TRƯỚC khi dọn giỏ: lỗi (vd thiếu cấu hình SePay) thì giỏ còn
        // nguyên. Đơn chỉ PAID khi webhook SePay xác nhận tiền đã vào tài khoản.
        if (!unwrap(await createSePayCheckout(orderData.id, true))) return;
        clearCart();
        // Giữ isSubmitting=true cho tới khi trang thanh toán mount, tránh nháy màn giỏ rỗng.
        router.push(`/payments/sepay/${orderData.id}`);
        return;
      }

      // Luồng momo/card (hoàn tất ngay) — cần JWT và chỉ chủ đơn.
      clearCart();
      const idempotencyKey = `IDEM-${Date.now()}-${orderData.id}`;
      const payData = unwrap(await payOrder(orderData.id, paymentMethod, idempotencyKey));
      if (!payData) return;

      router.push(`/order-success?orderId=${orderData.id}&transId=${payData.transactionId}`);
    } catch (err: unknown) {
      console.error('Payment error:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình thanh toán.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  // ===== FORM XÁC NHẬN ĐƠN =====
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">THANH TOÁN AN TOÀN</span>
          <h1 className="text-3xl font-bold text-gray-900">Xác nhận đơn hàng</h1>
          <p className="text-xs text-gray-500">Kiểm tra lại món và lựa chọn phương thức thanh toán phù hợp.</p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs flex justify-between items-center">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
          </div>
        )}

        {cart.length === 0 ? (
          isSubmitting ? (
            // Đang tạo đơn/phiên thanh toán:
            // nếu render form thì giỏ rỗng nháy lên, dễ bị hiểu là bị "đẩy
            // về giỏ hàng" — thay bằng màn xử lý cho tới khi sang màn kế.
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center space-y-4">
              <div className="w-12 h-12 mx-auto border-4 border-[#006A32] border-t-transparent rounded-full animate-spin" />
              <h2 className="text-xl font-bold text-gray-800">Đang xử lý thanh toán…</h2>
              <p className="text-xs text-gray-500">Vui lòng đợi trong giây lát, đừng tắt trang này.</p>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center space-y-4">
              <div className="text-5xl">🛒</div>
              <h2 className="text-xl font-bold text-gray-800">Giỏ hàng của bạn chưa có món nào</h2>
              <p className="text-xs text-gray-500">Hãy quay lại menu để chọn món nước yêu thích nhé!</p>
              <button
                onClick={() => router.push('/')}
                className="bg-[#006A32] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow hover:bg-[#005227] transition"
              >
                Về Menu đặt món ›
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Cột trái: Danh sách món trong giỏ */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h2 className="text-lg font-bold">Đơn hàng của bạn</h2>
                <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-full font-semibold">{cart.length} món</span>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {cart.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-4 border-b border-gray-50 pb-4">
                    <img src={item.product.image} alt={item.product.name} className="w-16 h-16 rounded-2xl object-cover bg-gray-100" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{item.product.name}</h4>
                      <p className="text-xs text-gray-400">
                        Size {item.size} {(item.toppings ?? []).map((topping) => `+ ${topping.name}`).join(' ')} - x{item.quantity}
                      </p>
                      {item.note && <p className="text-[11px] text-amber-600 italic">Ghi chú: {item.note}</p>}
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="text-[11px] text-red-500 underline mt-1 hover:text-red-700"
                      >
                        Xóa món
                      </button>
                    </div>
                    <span className="font-bold text-sm text-[#006A32]">{item.totalPrice.toLocaleString('vi-VN')}₫</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột phải: Thanh toán */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <h2 className="text-lg font-bold border-b pb-4">Tóm tắt đơn hàng</h2>

              {/* Voucher */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 block">Mã giảm giá</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void applyVoucher();
                    }}
                    placeholder="VD: WELCOME10"
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#006A32]"
                  />
                  <button
                    onClick={applyVoucher}
                    disabled={validatingVoucher || !voucherInput.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold border border-[#006A32]/40 text-[#006A32] hover:bg-[#006A32]/5 transition disabled:opacity-50"
                  >
                    {validatingVoucher ? '...' : 'Áp dụng'}
                  </button>
                </div>
                {voucherError && (
                  <p role="alert" className="text-[11px] text-red-600">⚠️ {voucherError}</p>
                )}
                {voucher && (
                  <p className="text-[11px] text-emerald-700">
                    ✓ Đã áp dụng <span className="font-bold">{voucher.code}</span> — giảm {formatVnd(voucher.discountAmount)} (server sẽ tính lại khi tạo đơn)
                  </p>
                )}
              </div>
              {/* Đổi điểm thưởng */}
              <div className="space-y-3 rounded-2xl border border-[#006A32]/20 p-4">

                <div>
                  <h3 className="font-bold text-sm text-[#006A32]">
                    Điểm thưởng Phúc Long
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Số điểm hiện có: {loyalty?.loyaltyPoints ?? 0} điểm
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={pointsInput}
                    onChange={(e) => {
                      setPointsInput(e.target.value);
                      setLoyaltyError(null);
                    }}
                    placeholder="Nhập số điểm muốn đổi"
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-200"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setPointsInput(String(maxPoints));
                    }}
                    className="px-4 rounded-xl bg-[#006A32] text-white text-xs font-bold"
                  >
                    Tối đa
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  10.000đ = 1 điểm tích lũy.
                  1 điểm = 1.000đ giảm giá.
                </p>

                {loyaltyError && (
                  <p className="text-xs text-red-600">
                    {loyaltyError}
                  </p>
                )}

                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Tiền giảm từ điểm</span>
                  <strong>
                    -{loyaltyDiscount.toLocaleString('vi-VN')}đ
                  </strong>
                </div>

              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 block">Phương thức thanh toán</label>

                {PAYMENT_METHODS.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${paymentMethod === m.id ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${m.iconBg} rounded-lg flex items-center justify-center text-white font-bold text-xs`}>{m.icon}</div>
                      <div>
                        <h5 className="font-bold text-xs">{m.title}</h5>
                        <p className="text-[10px] text-gray-400">{m.hint}</p>
                      </div>
                    </div>
                    <input type="radio" checked={paymentMethod === m.id} readOnly className="text-[#006A32]" />
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs border-t pt-4">
                <div className="flex justify-between text-gray-500">
                  <span>Tạm tính</span>
                  <span>{formatVnd(totalCartPrice)}</span>
                </div>
                {voucher && discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Giảm giá ({voucher.code})</span>
                    <span>-{formatVnd(discountAmount)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Đổi {pointsToRedeem} điểm</span>
                    <span>-{loyaltyDiscount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>Phí dịch vụ</span>
                  <span>0₫</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t">
                  <span>Tổng cộng</span>
                  <span className="text-[#006A32] text-xl font-extrabold">{formatVnd(finalTotal)}</span>
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-2xl font-bold shadow-lg transition flex justify-center items-center space-x-2 text-white ${isSubmitting ? 'bg-stone-400 cursor-not-allowed' : 'bg-[#006A32] hover:bg-[#005227]'
                  }`}
              >
                <span>{isSubmitting ? 'Đang xử lý thanh toán...' : `Xác nhận trả ${formatVnd(finalTotal)}`}</span>
                {!isSubmitting && <span>›</span>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
