'use client';

import React, { useState, useEffect } from 'react';
import ProductModal from '@/components/ProductModal';
import SiteHeader from '@/components/SiteHeader';
import { fetchProducts } from '@/lib/api';
import { addToCart, useCart } from '@/lib/cart';
import { Product, CartItem } from '@/app/types';

const categories = ['Tất cả', 'Cà Phê'];

export default function Home() {
  const { setCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả');

  // 3 trạng thái bắt buộc theo tiêu chí Task 4.3 của đề bài
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async (cat: string) => {
    setLoading(true);
    setError(null);
    const res = await fetchProducts(cat);
    if (res.ok) {
      setProducts(res.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts(activeCategory);
  }, [activeCategory]);

  /** Thêm vào giỏ (gộp món trùng) — đã có SiteHeader hiện số lượng nên ở lại menu. */
  const handleAddToCart = (newItem: CartItem) => {
    setCart((current) => addToCart(current, newItem));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDFBF7] via-[#F8F4EC] to-[#F2EFEA] text-stone-800 font-sans antialiased relative">
      <SiteHeader />

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Left: Category filters */}
        <aside className="md:col-span-1 space-y-4">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 border border-stone-200/80 shadow-sm space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">Khám phá menu</span>
            <h2 className="text-xl font-extrabold text-stone-900">Danh mục</h2>
            <div className="space-y-1.5 pt-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl font-bold text-sm flex justify-between items-center transition-all ${
                    activeCategory === cat
                      ? 'bg-[#006A32] text-white shadow-md shadow-[#006A32]/15'
                      : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={activeCategory === cat ? 'text-emerald-200 text-base' : 'text-stone-400'}>›</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Content Right */}
        <main className="md:col-span-3 space-y-8">
          {/* Banner Hero */}
          <div className="relative rounded-3xl p-8 lg:p-10 text-white overflow-hidden bg-gradient-to-br from-[#052917] via-[#006A32] to-[#084B26] shadow-xl shadow-[#006A32]/15 border border-emerald-700/20 flex justify-between items-center">
            <div className="max-w-lg space-y-3 z-10">
              <span className="inline-block text-xs tracking-widest text-emerald-300 font-extrabold uppercase bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                ĐẶT MÓN NHANH CHÓNG - CHÍNH HÃNG PHÚC LONG
              </span>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                Đặt hàng không dùng tiền mặt
              </h1>
              <p className="text-sm lg:text-base text-emerald-100/90 leading-relaxed">
                Trải nghiệm đặt nước hiện đại, giữ trọn hương vị trà đậm chất Phúc Long.
              </p>
            </div>
            <div className="hidden lg:block text-7xl opacity-20 select-none font-serif font-black">
              🧋
            </div>
          </div>

          {/* Product Grid Header */}
          <div className="space-y-5">
            <div className="flex justify-between items-end border-b border-stone-200/80 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">Thưởng thức ngay</span>
                <h2 className="text-2xl font-extrabold text-stone-900">{activeCategory}</h2>
              </div>
            </div>

            {/* TRẠNG THÁI 1: LOADING */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white/70 rounded-3xl p-4 border border-stone-200 animate-pulse space-y-3">
                    <div className="h-44 bg-stone-200 rounded-2xl w-full"></div>
                    <div className="h-4 bg-stone-200 rounded w-3/4"></div>
                    <div className="h-3 bg-stone-200 rounded w-1/2"></div>
                    <div className="h-6 bg-stone-200 rounded w-1/3 pt-2"></div>
                  </div>
                ))}
              </div>
            )}

            {/* TRẠNG THÁI 2: ERROR */}
            {!loading && error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3 my-6">
                <div className="text-3xl">⚠️</div>
                <h3 className="font-bold text-red-800 text-sm">Không thể kết nối máy chủ API</h3>
                <p className="text-xs text-red-600 max-w-md mx-auto">{error}</p>
                <button
                  onClick={() => void loadProducts(activeCategory)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md transition"
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* TRẠNG THÁI 3: EMPTY */}
            {!loading && !error && products.length === 0 && (
              <div className="bg-white/80 rounded-3xl p-12 text-center border border-stone-200/80 space-y-3 my-6">
                <div className="text-4xl">🍵</div>
                <h3 className="font-bold text-stone-800 text-base">Hiện chưa có món nào trong danh mục này</h3>
                <p className="text-xs text-stone-500">Vui lòng quay lại danh mục khác hoặc thử lại sau.</p>
              </div>
            )}

            {/* DANH SÁCH MÓN KHI CÓ DỮ LIỆU */}
            {!loading && !error && products.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedProduct(item)}
                    className="bg-white/90 backdrop-blur-sm rounded-3xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-stone-200/80 cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-stone-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        {item.tag && (
                          <span className={`absolute top-3 left-3 px-2.5 py-1 text-[10px] font-black text-white rounded-lg shadow-sm ${
                            item.tag === 'BÁN CHẠY' ? 'bg-amber-600' : 'bg-blue-600'
                          }`}>
                            {item.tag}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <h4 className="font-extrabold text-base text-stone-900 group-hover:text-[#006A32] transition-colors line-clamp-1">{item.name}</h4>
                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{item.description}</p>
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-stone-100 flex justify-between items-center">
                      <div>
                        <span className="text-[11px] text-stone-400 block font-medium">Giá từ</span>
                        <span className="font-black text-[#006A32] text-lg">{item.basePrice.toLocaleString('vi-VN')}₫</span>
                      </div>
                      <button className="w-9 h-9 rounded-full bg-[#006A32]/10 text-[#006A32] font-bold text-base flex items-center justify-center group-hover:bg-[#006A32] group-hover:text-white transition-colors">
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <ProductModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
