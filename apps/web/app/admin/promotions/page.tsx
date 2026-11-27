'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';

interface Promotion {
  id: number;
  code: string;
  name: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export default function AdminPromotionsPage() {
  const [data, setData] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    code: '',
    name: '',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderAmount: 50000,
    usageLimit: 100,
    startsAt: '',
    endsAt: '',
  });

  const loadData = async () => {
    const res = await fetch('/api/promotions/admin', {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error('Không thể tải danh sách voucher');
    }

    setData(await res.json());
  };

  useEffect(() => {
    // Thiết lập ngày bắt đầu mặc định theo giờ địa phương
    const now = new Date();

    const localDateTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    setForm((prev) => ({
      ...prev,
      startsAt: localDateTime,
    }));

    // Tải danh sách voucher
    loadData()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const createVoucher = async () => {
    setError('');

    if (!form.code.trim() || !form.name.trim()) {
      setError('Vui lòng nhập mã voucher và tên chương trình');
      return;
    }

    if (!form.startsAt) {
      setError('Vui lòng chọn ngày bắt đầu');
      return;
    }

    if (form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError('Ngày kết thúc phải sau ngày bắt đầu');
      return;
    }

    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt
            ? new Date(form.endsAt).toISOString()
            : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();

        setError(
          Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message || 'Không thể tạo voucher'
        );
        return;
      }

      setForm((prev) => ({
        ...prev,
        code: '',
        name: '',
      }));

      await loadData();
    } catch {
      setError('Không thể kết nối đến máy chủ');
    }
  };

  const toggleVoucher = async (item: Promotion) => {
    const res = await fetch(`/api/promotions/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        isActive: !item.isActive,
      }),
    });

    if (!res.ok) {
      setError('Không thể cập nhật trạng thái voucher');
      return;
    }

    await loadData();
  };

  return (
    <main className="min-h-screen bg-[#faf9f6] p-6">

      <h1 className="text-3xl font-extrabold text-[#006A32]">
        Quản lý Voucher
      </h1>

      <section className="bg-white rounded-2xl p-6 mt-6 shadow-sm space-y-4">

        <h2 className="font-bold text-lg">
          Thêm voucher mới
        </h2>

        <div className="grid md:grid-cols-2 gap-4">

          <input
            placeholder="Mã voucher"
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toUpperCase() })
            }
            className="border rounded-xl p-3"
          />

          <input
            placeholder="Tên chương trình"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            className="border rounded-xl p-3"
          />

          <select
            value={form.discountType}
            onChange={(e) =>
              setForm({
                ...form,
                discountType: e.target.value,
              })
            }
            className="border rounded-xl p-3"
          >
            <option value="PERCENT">Giảm theo phần trăm</option>
            <option value="FIXED">Giảm số tiền cố định</option>
          </select>

          <input
            type="number"
            placeholder="Giá trị giảm"
            value={form.discountValue}
            onChange={(e) =>
              setForm({
                ...form,
                discountValue: Number(e.target.value),
              })
            }
            className="border rounded-xl p-3"
          />

          <input
            type="number"
            placeholder="Đơn hàng tối thiểu"
            value={form.minOrderAmount}
            onChange={(e) =>
              setForm({
                ...form,
                minOrderAmount: Number(e.target.value),
              })
            }
            className="border rounded-xl p-3"
          />

          <input
            type="number"
            placeholder="Số lượt sử dụng"
            value={form.usageLimit}
            onChange={(e) =>
              setForm({
                ...form,
                usageLimit: Number(e.target.value),
              })
            }
            className="border rounded-xl p-3"
          />

          <div>
            <label className="text-xs">Ngày bắt đầu</label>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) =>
                setForm({ ...form, startsAt: e.target.value })
              }
              className="border rounded-xl p-3 w-full"
            />
          </div>

          <div>
            <label className="text-xs">Ngày kết thúc</label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) =>
                setForm({ ...form, endsAt: e.target.value })
              }
              className="border rounded-xl p-3 w-full"
            />
          </div>

        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          onClick={createVoucher}
          className="bg-[#006A32] text-white px-6 py-3 rounded-xl font-bold"
        >
          Thêm Voucher
        </button>

      </section>

      <section className="bg-white rounded-2xl p-6 mt-6 shadow-sm">

        <h2 className="font-bold text-lg mb-4">
          Danh sách Voucher
        </h2>

        {loading ? (
          <p>Đang tải dữ liệu...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Mã</th>
                  <th className="p-3">Tên</th>
                  <th className="p-3">Giá trị</th>
                  <th className="p-3">Đã dùng</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 font-bold">
                      {item.code}
                    </td>

                    <td className="p-3">{item.name}</td>

                    <td className="p-3">
                      {item.discountType === 'PERCENT'
                        ? `${item.discountValue}%`
                        : `${item.discountValue.toLocaleString('vi-VN')}đ`}
                    </td>

                    <td className="p-3">
                      {item.usedCount}/
                      {item.usageLimit ?? '∞'}
                    </td>

                    <td className="p-3">
                      {item.isActive ? 'Đang bật' : 'Đã tắt'}
                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => void toggleVoucher(item)}
                        className="text-[#006A32] font-bold"
                      >
                        {item.isActive ? 'Ngừng' : 'Kích hoạt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </section>
    </main>
  );
}