'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CartItem } from '@/app/types';
import { clearToken, getToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** Đơn hàng đang có phiên SePay chờ thanh toán — để quay lại /checkout còn khôi phục đúng phiên. */
const PENDING_ORDER_KEY = 'phuclong_pending_order';

type PaymentMethod = 'momo' | 'card' | 'sepay';
type PayStatus = 'waiting' | 'expired' | 'failed';

/** Phiên thanh toán SePay trả về từ POST /payments/sepay. */
interface SePaySession {
  orderId: number;
  paymentCode: string;
  qrUrl: string;
  amount: number;
  expiresAt: string;
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepay');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phiên thanh toán SePay: có session → hiện màn hình QR thay cho form
  const [session, setSession] = useState<SePaySession | null>(null);
  const [payStatus, setPayStatus] = useState<PayStatus>('waiting');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const savedCart = localStorage.getItem('phuclong_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error(e);
      }
    }

    // Quay lại /checkout khi còn phiên SePay đang chờ → khôi phục đúng phiên cũ
    // (giỏ đã được dọn ngay khi tạo đơn, nên khôi phục dựa trên marker + API).
    const pendingOrderId = localStorage.getItem(PENDING_ORDER_KEY);
    const token = getToken();
    if (!pendingOrderId || !token) return;

    fetch(`${API_BASE_URL}/payments/${pendingOrderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearToken();
          router.push('/login?next=/checkout');
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data) return;
        if (data.status === 'PAID') {
          localStorage.removeItem(PENDING_ORDER_KEY);
          router.push(`/order-success?orderId=${data.orderId}&transId=${data.transactionId}`);
        } else if (
          data.status === 'PENDING' &&
          data.qrUrl &&
          new Date(data.expiresAt).getTime() > Date.now()
        ) {
          setSession({
            orderId: data.orderId,
            paymentCode: data.paymentCode,
            qrUrl: data.qrUrl,
            amount: data.amount,
            expiresAt: data.expiresAt,
          });
          setPayStatus('waiting');
        } else {
          // EXPIRED / FAILED / không còn phiên hợp lệ → về form trống giỏ
          localStorage.removeItem(PENDING_ORDER_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(PENDING_ORDER_KEY);
      });
    // Chạy đúng một lần lúc mount: session luôn null lúc này, và không được
    // re-run khi người dùng chủ động bấm "chọn lại phương thức" (session về null).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đếm ngược từ hạn chót do server trả (expiresAt) + poll trạng thái mỗi 3 giây.
  // Backend là nguồn sự thật: webhook SePay hay hết hạn đều được poll phản ánh.
  useEffect(() => {
    if (!session || payStatus !== 'waiting') return;

    const deadline = new Date(session.expiresAt).getTime();
    let pollCount = 0;
    let stopped = false;

    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        setPayStatus('expired');
        return;
      }

      pollCount += 1;
      if (pollCount % 3 !== 0) return;

      fetch(`${API_BASE_URL}/payments/${session.orderId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
        .then(async (res) => {
          if (res.status === 401) {
            // Token hết hạn giữa phiên → đăng nhập lại rồi quay tiếp /checkout.
            stopped = true;
            clearToken();
            router.push('/login?next=/checkout');
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then((data) => {
          if (stopped || !data) return;
          if (data.status === 'PAID') {
            stopped = true;
            localStorage.removeItem(PENDING_ORDER_KEY);
            router.push(
              `/order-success?orderId=${data.orderId}&transId=${data.transactionId}`,
            );
          } else if (data.status === 'EXPIRED') {
            setPayStatus('expired');
          } else if (data.status === 'FAILED') {
            setPayStatus('failed');
          }
        })
        .catch(() => {
          // lỗi mạng tạm thời: tiếp tục poll, hết hạn do đếm ngược phía client
        });
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, payStatus, router]);

  const totalCartPrice = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleRemoveItem = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
    localStorage.setItem('phuclong_cart', JSON.stringify(updatedCart));
  };

  async function createOrder(token: string) {
    // Client KHÔNG gửi giá: server tra bảng giá và tự tính unitPrice/total.
    const orderPayload = {
      items: cart.map((item) => ({
        productId: item.product.id,
        size: item.size,
        qty: item.quantity,
        toppings: (item.toppings ?? []).map((topping) => topping.name),
        note: item.note || undefined,
      })),
    };

    const orderRes = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (orderRes.status === 401) {
      // Token hết hạn hoặc không hợp lệ → đăng nhập lại.
      clearToken();
      router.push('/login?next=/checkout');
      return null;
    }
    if (!orderRes.ok) {
      throw new Error(`Tạo đơn thất bại (${orderRes.status})`);
    }
    return orderRes.json();
  }

  async function createSePaySession(orderId: number, token: string) {
    const res = await fetch(`${API_BASE_URL}/payments/sepay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
    if (res.status === 401) {
      clearToken();
      router.push('/login?next=/checkout');
      return null;
    }
    if (!res.ok) {
      throw new Error(`Tạo phiên thanh toán SePay thất bại (${res.status})`);
    }
    return res.json();
  }

  const handleConfirmPayment = async () => {
    if (cart.length === 0) return;

    // Đặt đơn cần đăng nhập: chưa có token thì chuyển sang /login rồi quay lại đây.
    const token = getToken();
    if (!token) {
      router.push('/login?next=/checkout');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const orderData = await createOrder(token);
      if (!orderData) return;

      // Giỏ đã được chốt vào đơn → dọn giỏ NGAY LÚC NÀY, đỡ đợi payment.
      // Từ đây mọi hiển thị (QR, số tiền, retry) dựa trên đơn + phiên SePay,
      // không dựa vào giỏ nữa → không còn "giỏ hàng cũ" tồn đọng.
      localStorage.removeItem('phuclong_cart');
      setCart([]);

      if (paymentMethod === 'sepay') {
        // Thanh toán online SePay: tạo phiên QR rồi sang màn hình chờ,
        // đơn chỉ PAID khi webhook SePay xác nhận tiền đã vào tài khoản.
        const sessionData = await createSePaySession(orderData.id, token);
        if (!sessionData) return;
        localStorage.setItem(PENDING_ORDER_KEY, String(sessionData.orderId));
        setSession(sessionData);
        setPayStatus('waiting');
        return;
      }

      // Luồng momo/card (hoàn tất ngay) giữ nguyên.
      const idempotencyKey = `IDEM-${Date.now()}-${orderData.id}`;
      const payRes = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          orderId: orderData.id,
          method: paymentMethod,
          idempotencyKey,
        }),
      });

      if (!payRes.ok) {
        throw new Error(`Xử lý thanh toán thất bại (${payRes.status})`);
      }

      const payData = await payRes.json();

      router.push(`/order-success?orderId=${orderData.id}&transId=${payData.transactionId}`);
    } catch (err: unknown) {
      console.error('Payment error:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình thanh toán.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // "Thử lại" sau khi phiên hết hạn/thất bại: tạo phiên mới cho cùng đơn hàng.
  const handleRetrySePay = async () => {
    const token = getToken();
    if (!token || !session) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const sessionData = await createSePaySession(session.orderId, token);
      if (!sessionData) return;
      localStorage.setItem(PENDING_ORDER_KEY, String(sessionData.orderId));
      setSession(sessionData);
      setPayStatus('waiting');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không tạo lại được phiên thanh toán.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Demo local: giả lập SePay báo "tiền đã vào tài khoản" — SePay không gọi
  // được localhost, nên khi chạy dev cần nút này để thấy luồng PAID đầy đủ.
  // Backend tự chặn endpoint này khi NODE_ENV=production.
  const handleSimulateTransfer = async () => {
    if (!session) return;
    const token = getToken();
    if (!token) {
      router.push('/login?next=/checkout');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/payments/sepay/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: session.orderId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Mô phỏng thất bại (${res.status})`);
      }
      // Poll 3 giây/lần sẽ bắt được PAID và chuyển sang trang thành công.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mô phỏng chuyển khoản thất bại.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const header = (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
      <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
        <span className="bg-[#006A32] text-white px-2.5 py-1 rounded-md font-bold text-sm">PL</span>
        <span className="font-bold tracking-wider text-gray-900">PHÚC LONG</span>
      </div>
      <button onClick={() => router.push('/')} className="text-sm font-semibold text-[#006A32]">
        ← Quay lại menu
      </button>
    </header>
  );

  // ===== MÀN HÌNH QR SEPAY (đang chờ chuyển khoản hoặc hết hạn/thất bại) =====
  if (session) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
        {header}
        <main className="max-w-md mx-auto px-6 py-10">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center space-y-5">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              Thanh toán chuyển khoản qua SePay
            </span>
            <h1 className="text-xl font-bold">Quét mã QR để thanh toán</h1>
            <p className="text-xs text-gray-500">
              Dùng app ngân hàng quét mã bên dưới — hệ thống tự xác nhận khi tiền vào tài khoản.
            </p>

            <div className="flex justify-center">
              <img
                src={session.qrUrl}
                alt="Mã QR SePay"
                className="w-56 h-56 rounded-2xl border border-gray-100 bg-white"
              />
            </div>

            {errorMessage && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
                ⚠️ {errorMessage}
              </p>
            )}

            <div className="space-y-1">
              <p className="text-xs text-gray-400">Số tiền</p>
              <p className="text-2xl font-extrabold text-[#006A32]">
                {session.amount.toLocaleString('vi-VN')}₫
              </p>
              <p className="text-xs text-gray-500">
                Nội dung chuyển khoản: <span className="font-bold text-gray-900">{session.paymentCode}</span>
              </p>
            </div>

            {payStatus === 'waiting' && (
              <div className="space-y-3">
                <div className="inline-flex items-center space-x-2 bg-[#006A32]/5 border border-[#006A32]/20 rounded-full px-4 py-2">
                  <span className="w-2 h-2 bg-[#006A32] rounded-full animate-pulse"></span>
                  <span className="text-xs font-bold text-[#006A32]">
                    Đang chờ chuyển khoản — còn {formatCountdown(secondsLeft)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Sau 2 phút không thanh toán, phiên sẽ hết hạn và bạn có thể tạo lại mã QR.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleSimulateTransfer}
                    disabled={isSubmitting}
                    className="text-xs font-bold text-[#006A32] border border-[#006A32]/30 bg-[#006A32]/5 hover:bg-[#006A32]/10 rounded-full px-4 py-2 transition disabled:opacity-60"
                  >
                    ⚡ Mô phỏng chuyển khoản (demo local)
                  </button>
                )}
              </div>
            )}

            {payStatus === 'expired' && (
              <div className="space-y-4">
                <p role="alert" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
                  ⏰ Hết thời gian thanh toán (2 phút). Đơn hàng vẫn được giữ, hãy thử lại nếu cần.
                </p>
                <button
                  onClick={handleRetrySePay}
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl font-bold text-white bg-[#006A32] hover:bg-[#005227] transition disabled:opacity-60"
                >
                  {isSubmitting ? 'Đang tạo mã QR mới…' : 'Tạo lại mã QR (giữ nguyên đơn)'}
                </button>
              </div>
            )}

            {payStatus === 'failed' && (
              <div className="space-y-4">
                <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
                  ⚠️ Thanh toán không thành công (số tiền không đủ hoặc đơn đã được thanh toán).
                </p>
                <button
                  onClick={handleRetrySePay}
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-2xl font-bold text-white bg-[#006A32] hover:bg-[#005227] transition disabled:opacity-60"
                >
                  {isSubmitting ? 'Đang tạo mã QR mới…' : 'Tạo lại mã QR'}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setSession(null);
                setPayStatus('waiting');
              }}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 underline"
            >
              ← Chọn lại phương thức thanh toán
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ===== FORM XÁC NHẬN ĐƠN =====
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      {header}

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
                  <div key={index} className="flex items-center space-x-4 border-b border-gray-50 pb-4">
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

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 block">Phương thức thanh toán</label>

                <div
                  onClick={() => setPaymentMethod('sepay')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${paymentMethod === 'sepay' ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-[#006A32] rounded-lg flex items-center justify-center text-white font-bold text-xs">₫</div>
                    <div>
                      <h5 className="font-bold text-xs">Chuyển khoản ngân hàng</h5>
                      <p className="text-[10px] text-gray-400">SePay — quét QR, tự xác nhận trong 2 phút</p>
                    </div>
                  </div>
                  <input type="radio" checked={paymentMethod === 'sepay'} readOnly className="text-[#006A32]" />
                </div>

                <div
                  onClick={() => setPaymentMethod('momo')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${paymentMethod === 'momo' ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">M</div>
                    <div>
                      <h5 className="font-bold text-xs">Ví điện tử</h5>
                      <p className="text-[10px] text-gray-400">MoMo / ZaloPay</p>
                    </div>
                  </div>
                  <input type="radio" checked={paymentMethod === 'momo'} readOnly className="text-[#006A32]" />
                </div>

                <div
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${paymentMethod === 'card' ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">💳</div>
                    <div>
                      <h5 className="font-bold text-xs">Thẻ ngân hàng</h5>
                      <p className="text-[10px] text-gray-400">Visa / Mastercard / Napas</p>
                    </div>
                  </div>
                  <input type="radio" checked={paymentMethod === 'card'} readOnly className="text-[#006A32]" />
                </div>
              </div>

              <div className="space-y-2 text-xs border-t pt-4">
                <div className="flex justify-between text-gray-500">
                  <span>Tạm tính</span>
                  <span>{totalCartPrice.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Phí dịch vụ</span>
                  <span>0₫</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t">
                  <span>Tổng cộng</span>
                  <span className="text-[#006A32] text-xl font-extrabold">{totalCartPrice.toLocaleString('vi-VN')}₫</span>
                </div>
              </div>

              <button
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
                className={`w-full py-3.5 rounded-2xl font-bold shadow-lg transition flex justify-center items-center space-x-2 text-white ${isSubmitting ? 'bg-stone-400 cursor-not-allowed' : 'bg-[#006A32] hover:bg-[#005227]'
                  }`}
              >
                <span>{isSubmitting ? 'Đang xử lý thanh toán...' : 'Xác nhận trả'}</span>
                {!isSubmitting && <span>›</span>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
