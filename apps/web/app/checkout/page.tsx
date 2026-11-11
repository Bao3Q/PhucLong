'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CartItem } from '@/app/types';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card'>('momo');

  useEffect(() => {
    const savedCart = localStorage.getItem('phuclong_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const totalCartPrice = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleRemoveItem = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
    localStorage.setItem('phuclong_cart', JSON.stringify(updatedCart));
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-gray-900">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
          <span className="bg-[#006A32] text-white px-2.5 py-1 rounded-md font-bold text-sm">PL</span>
          <span className="font-bold tracking-wider text-gray-900">PHÚC LONG</span>
        </div>
        <button onClick={() => router.push('/')} className="text-sm font-semibold text-[#006A32]">
          ← Quay lại menu
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">THANH TOÁN AN TOÀN</span>
          <h1 className="text-3xl font-bold text-gray-900">Xác nhận đơn hàng</h1>
          <p className="text-xs text-gray-500">Kiểm tra lại món và lựa chọn phương thức thanh toán phù hợp.</p>
        </div>

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
                    <img src={item.product.image} className="w-16 h-16 rounded-2xl object-cover bg-gray-100" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm">{item.product.name}</h4>
                      <p className="text-xs text-gray-400">
                        Size {item.size} {item.hasTranChau ? '+ Trân châu' : ''} {item.hasKem ? '+ Kem' : ''} - x{item.quantity}
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

              <div className="flex space-x-2">
                <input type="text" placeholder="Nhập mã ưu đãi" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs focus:outline-none" />
                <button className="bg-gray-100 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-gray-200">Áp dụng</button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400 block">Thanh toán không tiền mặt</label>
                
                <div 
                  onClick={() => setPaymentMethod('momo')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                    paymentMethod === 'momo' ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
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
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition ${
                    paymentMethod === 'card' ? 'border-[#006A32] bg-[#006A32]/5' : 'border-gray-200'
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
                onClick={() => router.push('/order-success')}
                className="w-full bg-[#006A32] text-white py-3.5 rounded-2xl font-bold shadow-lg hover:bg-[#005227] transition flex justify-center items-center space-x-2"
              >
                <span>Xác nhận trả</span>
                <span>›</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}