"use client"

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatRupiah } from '@/lib/utils'
import { TrendingUp, ShoppingBag, Clock, AlertTriangle, DollarSign } from 'lucide-react'

interface DashboardStats {
  active_orders: number
  pending_orders: number
  completed_orders: number
  total_revenue: number
  pending_claims: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    api.get('/admin/dashboard').then(res => {
      if (res.data.success) setStats(res.data.data)
    }).catch(() => {})
  }, [])

  const cards = stats ? [
    { icon: DollarSign, label: 'Total Revenue', value: formatRupiah(stats.total_revenue), color: '#C5EFD8', iconColor: '#22c55e' },
    { icon: ShoppingBag, label: 'Order Aktif', value: stats.active_orders.toString(), color: '#C8E6F5', iconColor: '#3b82f6' },
    { icon: Clock, label: 'Pending', value: stats.pending_orders.toString(), color: '#FAE88A', iconColor: '#eab308' },
    { icon: TrendingUp, label: 'Selesai', value: stats.completed_orders.toString(), color: '#DDD5F3', iconColor: '#8b5cf6' },
    { icon: AlertTriangle, label: 'Klaim Pending', value: stats.pending_claims.toString(), color: '#FDDAC8', iconColor: '#f97316' },
  ] : []

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Admin Dashboard</h1>

      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#EBEBEB] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.color }}>
                  <c.icon className="w-5 h-5" style={{ color: c.iconColor }} />
                </div>
              </div>
              <div className="text-xl font-extrabold mb-0.5">{c.value}</div>
              <div className="text-xs text-[#888] font-medium">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
