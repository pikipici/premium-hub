"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, ShoppingBag } from 'lucide-react'

import WalletCard from '@/components/shared/WalletCard'
import { formatRupiah } from '@/lib/utils'
import { activityService } from '@/services/activityService'
import { orderService } from '@/services/orderService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { ActivityHistoryItem } from '@/types/activity'
import type { Order } from '@/types/order'

function activityAmountText(item: ActivityHistoryItem) {
  const amount = formatRupiah(item.amount)
  return item.direction === 'credit' ? `+${amount}` : `-${amount}`
}

function activityAmountClass(item: ActivityHistoryItem) {
  return item.direction === 'credit' ? 'text-green-600' : 'text-[#141414]'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, setWalletBalance } = useAuthStore()

  const [orders, setOrders] = useState<Order[]>([])
  const [recentActivities, setRecentActivities] = useState<ActivityHistoryItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const [wallet, setWallet] = useState({ balance: 0, totalTopup: 0, totalSpent: 0 })
  const [walletLoading, setWalletLoading] = useState(true)

  useEffect(() => {
    orderService
      .list({ limit: 20 })
      .then((res) => {
        if (res.success) setOrders(res.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    activityService
      .listHistory({ page: 1, limit: 5 })
      .then((res) => {
        if (res.success) setRecentActivities(res.data)
      })
      .catch(() => {})
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => {
    walletService
      .getWallet()
      .then((res) => {
        setWallet({
          balance: res.balance,
          totalTopup: res.total_topup ?? 0,
          totalSpent: res.total_spent ?? 0,
        })
        setWalletBalance(res.balance)
      })
      .catch(() => {})
      .finally(() => setWalletLoading(false))
  }, [setWalletBalance])

  const activeOrders = orders.filter((o) => o.order_status === 'active')
  const pendingOrders = orders.filter((o) => o.payment_status === 'pending')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold">Halo, {user?.name}! 👋</h1>

      <WalletCard
        balance={wallet.balance}
        totalTopup={wallet.totalTopup}
        totalSpent={wallet.totalSpent}
        loading={walletLoading}
        onTopUp={() => router.push('/dashboard/wallet')}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: ShoppingBag, label: 'Akun Aktif', value: activeOrders.length, color: '#C5EFD8', iconColor: '#22c55e' },
          { icon: Clock, label: 'Pending', value: pendingOrders.length, color: '#FAE88A', iconColor: '#eab308' },
          { icon: CheckCircle, label: 'Total Order', value: orders.length, color: '#C8E6F5', iconColor: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: s.color }}>
                <s.icon className="h-5 w-5" style={{ color: s.iconColor }} />
              </div>
              <span className="text-sm font-medium text-[#888]">{s.label}</span>
            </div>
            <div className="text-2xl font-extrabold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">Aktivitas Terbaru</h3>
          <Link href="/dashboard/riwayat-order" className="text-xs font-medium text-[#FF5733] hover:underline">
            Lihat Semua
          </Link>
        </div>

        {activityLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F4F4F2]" />
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="py-10 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-[#EBEBEB]" />
            <p className="text-sm text-[#888]">Belum ada aktivitas</p>
            <Link href="/product/prem-apps" className="mt-2 inline-block text-sm font-medium text-[#FF5733] hover:underline">
              Belanja Sekarang →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <Link
                key={activity.id}
                href="/dashboard/riwayat-order"
                className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-[#F7F7F5]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="text-2xl">{activity.icon || '📦'}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{activity.title}</div>
                    <div className="truncate text-xs text-[#888]">{new Date(activity.occurred_at).toLocaleDateString('id-ID')} • {activity.source_label}</div>
                  </div>
                </div>

                <div className="ml-3 shrink-0 text-right">
                  <div className={`text-sm font-bold ${activityAmountClass(activity)}`}>{activityAmountText(activity)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
