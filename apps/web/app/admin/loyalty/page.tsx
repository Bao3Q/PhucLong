'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';

interface LoyaltyUser {
  id: string;
  email: string;
  loyaltyPoints: number;
}

export default function AdminLoyaltyPage() {
  const [users, setUsers] = useState<LoyaltyUser[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [points, setPoints] = useState(0);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const loadUsers = async () => {
    const res = await fetch(
      '/api/payments/loyalty/admin/users',
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error('Không thể tải danh sách khách hàng');
    }

    setUsers(await res.json());
  };

  useEffect(() => {
    loadUsers().catch((e) => setError(e.message));
  }, []);

  const adjustPoints = async () => {
    setError('');

    if (!selectedUser || points === 0 || !description.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const res = await fetch(
      '/api/payments/loyalty/admin/adjust',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          userId: selectedUser,
          points,
          description,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json();
      setError(body.message || 'Điều chỉnh điểm thất bại');
      return;
    }

    setPoints(0);
    setDescription('');

    await loadUsers();
  };

  return (
    <main className="min-h-screen bg-[#faf9f6] p-6">

      <h1 className="text-3xl font-extrabold text-[#006A32]">
        Quản lý điểm thưởng
      </h1>

      <section className="bg-white rounded-2xl p-6 mt-6 space-y-4 shadow-sm">

        <h2 className="font-bold text-lg">
          Điều chỉnh điểm khách hàng
        </h2>

        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full border rounded-xl p-3"
        >
          <option value="">Chọn khách hàng</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.email} - {user.loyaltyPoints} điểm
            </option>
          ))}
        </select>

        <input
          type="number"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          placeholder="Số điểm (+ cộng / - trừ)"
          className="w-full border rounded-xl p-3"
        />

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lý do điều chỉnh điểm"
          className="w-full border rounded-xl p-3"
        />

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          onClick={adjustPoints}
          className="bg-[#006A32] text-white px-6 py-3 rounded-xl font-bold"
        >
          Xác nhận điều chỉnh
        </button>

      </section>

      <section className="bg-white rounded-2xl p-6 mt-6 shadow-sm">

        <h2 className="font-bold text-lg mb-4">
          Danh sách điểm thưởng khách hàng
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Email</th>
                <th className="p-3">Tổng điểm</th>
                <th className="p-3">Giá trị quy đổi</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">{user.email}</td>

                  <td className="p-3 font-bold text-[#006A32]">
                    {user.loyaltyPoints}
                  </td>

                  <td className="p-3">
                    {(user.loyaltyPoints * 1000).toLocaleString('vi-VN')}đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </section>

    </main>
  );
}