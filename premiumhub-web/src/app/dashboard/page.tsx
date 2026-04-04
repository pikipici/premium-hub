"use client"

import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { orderService } from '@/services/orderService'
import { formatRupiah } from '@/lib/utils'
import type { Order } from '@/types/order'
import Link from 'next/link'
import { ShoppingBag, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    orderService.list({ limit: 5 }).then(res => {
      if (res.success) setOrders(res.data)
    }).catch(() => {})
  }, [])

  const activeOrders = orders.filter(o => o.order_status === 'active')
  const pendingOrders = orders.filter(o => o.payment_status === 'pending')

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Halo, {user?.name}! 👋</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: ShoppingBag, label: 'Akun Aktif', value: activeOrders.length, color: '#C5EFD8', iconColor: '#22c55e' },
          { icon: Clock, label: 'Pending', value: pendingOrders.length, color: '#FAE88A', iconColor: '#eab308' },
          { icon: CheckCircle, label: 'Total Order', value: orders.length, color: '#C8E6F5', iconColor: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#EBEBEB] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color }}>
                <s.icon className="w-5 h-5" style={{ color: s.iconColor }} />
              </div>
              <span className="text-sm text-[#888] font-medium">{s.label}</span>
            </div>
            <div className="text-2xl font-extrabold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold">Order Terbaru</h3>
          <Link href="/dashboard/riwayat-order" className="text-xs text-[#FF5733] font-medium hover:underline">Lihat Semua</Link>
        </div>
        {orders.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-10 h-10 text-[#EBEBEB] mx-auto mb-3" />
            <p className="text-sm text-[#888]">Belum ada order</p>
            <Link href="/katalog" className="text-sm text-[#FF5733] font-medium mt-2 inline-block hover:underline">Belanja Sekarang →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map(order => (
              <Link key={order.id} href={`/dashboard/riwayat-order`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F7F7F5] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{order.product?.icon || '📦'}</div>
                  <div>
                    <div className="text-sm font-semibold">{order.product?.name || 'Produk'}</div>
                    <div className="text-xs text-[#888]">{new Date(order.created_at).toLocaleDateString('id-ID')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatRupiah(order.total_price)}</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    order.order_status === 'active' ? 'bg-green-100 text-green-600' :
                    order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {order.order_status === 'active' ? 'Aktif' : order.payment_status === 'pending' ? 'Pending' : order.order_status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
