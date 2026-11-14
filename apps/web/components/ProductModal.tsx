'use client';

import React, { useState, useEffect } from 'react';
import { Product, ProductOption, CartItem } from '@/app/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAddToCart: (item: CartItem) => void;
}

export default function ProductModal({ isOpen, onClose, product, onAddToCart }: ProductModalProps) {
  const [size, setSize] = useState<'S' | 'M' | 'L'>('S');
  const [selectedToppings, setSelectedToppings] = useState<ProductOption[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSize('S');
      setSelectedToppings([]);
      setNote('');
      setQuantity(1);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  // Logic giá mới: Size S là giá gốc, M +5k, L +10k
  const getSizeAdjustment = () => {
    if (size === 'M') return 5000;
    if (size === 'L') return 10000;
    return 0; // Size S
  };

  const toppingTotal = selectedToppings.reduce((total, topping) => total + topping.price, 0);
  const unitPrice = product.basePrice + getSizeAdjustment() + toppingTotal;
  const totalPrice = unitPrice * quantity;

  const handleConfirm = () => {
    onAddToCart({
      product,
      size,
      toppings: selectedToppings,
      note,
      quantity,
      totalPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"
        >
          ✕
        </button>

        <div className="md:w-1/2 h-64 md:h-auto relative bg-gray-50">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </div>

        <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">PHÚC LONG SIGNATURE</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">{product.name}</h2>
            <div className="text-[#006A32] font-bold text-xl mt-1">
              {product.basePrice.toLocaleString('vi-VN')}₫
            </div>
            <p className="text-xs text-gray-500 mt-1">{product.description}</p>

            {/* Chọn Size mới */}
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-2">
                Chọn kích cỡ <span className="text-amber-600 font-normal">BẮT BUỘC</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'S', label: 'S', desc: 'Giá gốc' },
                  { key: 'M', label: 'M', desc: '+5.000đ' },
                  { key: 'L', label: 'L', desc: '+10.000đ' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSize(item.key as 'S' | 'M' | 'L')}
                    className={`p-3 rounded-xl border text-center transition ${
                      size === item.key 
                        ? 'border-[#006A32] bg-[#006A32]/5 text-[#006A32] font-bold' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Topping */}
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-2">
                Topping <span className="text-gray-400 font-normal">Có thể chọn nhiều</span>
              </label>
              <div className="space-y-2">
                {product.toppings?.length ? product.toppings.map((topping) => {
                  const isSelected = selectedToppings.some(({ id }) => id === topping.id);
                  return (
                    <label key={topping.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => setSelectedToppings((current) =>
                            e.target.checked
                              ? [...current, topping]
                              : current.filter(({ id }) => id !== topping.id)
                          )}
                          className="w-4 h-4 text-[#006A32] rounded focus:ring-[#006A32]"
                        />
                        <span className="text-sm font-medium text-gray-800">{topping.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        +{topping.price.toLocaleString('vi-VN')}đ
                      </span>
                    </label>
                  );
                }) : <p className="text-sm text-gray-500">Món này chưa có topping.</p>}
              </div>
            </div>

            {/* Ghi chú */}
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Ghi chú cho cửa hàng</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: ít ngọt, không dùng ống hút..." 
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-[#006A32]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center space-x-4">
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 space-x-3">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-gray-500 font-bold hover:text-black">-</button>
              <span className="font-bold text-sm w-4 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="text-gray-500 font-bold hover:text-black">+</button>
            </div>

            <button 
              onClick={handleConfirm}
              className="flex-1 bg-[#006A32] text-white py-3 px-6 rounded-xl font-bold flex justify-between items-center hover:bg-[#005227] transition shadow-lg shadow-[#006A32]/20"
            >
              <span>Thêm vào giỏ</span>
              <span>{totalPrice.toLocaleString('vi-VN')}₫</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}