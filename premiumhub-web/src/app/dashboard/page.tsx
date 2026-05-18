"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

import WalletCard from '@/components/shared/WalletCard'
import { ReceiptRefundIcon, TransactionDollarIcon } from '@/components/icons/TransactionIcons'
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
  return item.direction === 'credit' ? 'text-emerald-600' : 'text-[#141414]'
}

function renderActivityIcon(item: ActivityHistoryItem) {
  if (item.kind === 'nokos_purchase') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0ED] text-[#FF5733]">
        <TransactionDollarIcon className="h-5 w-5" />
      </div>
    )
  }

  if (item.kind === 'nokos_refund') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <ReceiptRefundIcon className="h-5 w-5" />
      </div>
    )
  }

  return <div className="text-2xl">{item.icon || '📦'}</div>
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

  const pendingOrders = orders.filter((o) => o.payment_status === 'pending')

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#A6A6A1]">Halo!</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#141414]">{user?.name || 'Selamat datang'} 👋</h1>
      </header>

      <WalletCard
        balance={wallet.balance}
        totalTopup={wallet.totalTopup}
        totalSpent={wallet.totalSpent}
        loading={walletLoading}
        onTopUp={() => router.push('/dashboard/wallet')}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-[#6B7280]">Pending</span>
          </div>
          <div className="text-2xl font-extrabold text-[#141414]">{pendingOrders.length}</div>
          <p className="mt-1 text-xs text-[#6B7280]">Order belum dibayar / sedang diproses</p>
        </div>

        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-[#6B7280]">Total Order</span>
          </div>
          <div className="text-2xl font-extrabold text-[#141414]">{orders.length}</div>
          <p className="mt-1 text-xs text-[#6B7280]">Total order yang udah lu buat</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#141414]">Aktivitas Terbaru</h3>
          <Link href="/dashboard/riwayat-order" className="text-xs font-semibold text-[#FF5733] hover:underline">
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
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-[#D9D9D6]" />
            <p className="text-sm font-semibold text-[#141414]">Belum ada aktivitas</p>
            <p className="mt-1 text-xs text-[#6B7280]">Mulai belanja produk digital, transaksi lu bakal muncul di sini.</p>
            <Link
              href="/product/prem-apps"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#141414] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#2A2A2A]"
            >
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
                  {renderActivityIcon(activity)}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#141414]">{activity.title}</div>
                    <div className="truncate text-xs text-[#6B7280]">
                      {new Date(activity.occurred_at).toLocaleDateString('id-ID')} • {activity.source_label}
                    </div>
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
