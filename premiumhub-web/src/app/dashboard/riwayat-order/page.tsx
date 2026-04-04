"use client"

import { useEffect, useState } from 'react'
import { orderService } from '@/services/orderService'
import { formatRupiah } from '@/lib/utils'
import type { Order } from '@/types/order'
import { History } from 'lucide-react'

export default function RiwayatOrderPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    orderService.list({ limit: 50 }).then(res => {
      if (res.success) setOrders(res.data)
    }).finally(() => setLoading(false))
  }, [])

  const statusBadge = (order: Order) => {
    const s = order.order_status
    const cls = s === 'active' ? 'bg-green-100 text-green-700' :
                s === 'completed' ? 'bg-blue-100 text-blue-700' :
                s === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
    const label = s === 'active' ? 'Aktif' : s === 'completed' ? 'Selesai' : s === 'failed' ? 'Gagal' : 'Pending'
    return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
        <History className="w-6 h-6" /> Riwayat Order
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EBEBEB] p-10 text-center">
          <p className="text-sm text-[#888]">Belum ada riwayat order</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border border-[#EBEBEB] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{order.product?.icon || '📦'}</div>
                <div>
                  <div className="text-sm font-bold">{order.product?.name || 'Produk'}</div>
                  <div className="text-xs text-[#888]">
                    {order.price?.duration} bulan • {order.price?.account_type}
                  </div>
                  <div className="text-xs text-[#888]">{new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold mb-1">{formatRupiah(order.total_price)}</div>
                {statusBadge(order)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
