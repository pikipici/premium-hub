"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type SVGProps } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  PackageCheck,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'

import WalletCard from '@/components/shared/WalletCard'
import { formatRupiah } from '@/lib/utils'
import { activityService } from '@/services/activityService'
import { notificationService } from '@/services/notificationService'
import { orderService } from '@/services/orderService'
import { sosmedOrderService } from '@/services/sosmedOrderService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type { ActivityHistoryItem } from '@/types/activity'
import type { NotificationItem } from '@/types/notification'
import type { Order } from '@/types/order'
import type { SosmedOrder } from '@/types/sosmedOrder'

function activityAmountText(item: ActivityHistoryItem) {
  const amount = formatRupiah(item.amount)
  return item.direction === 'credit' ? `+${amount}` : `-${amount}`
}

function activityAmountClass(item: ActivityHistoryItem) {
  return item.direction === 'credit' ? 'text-green-600' : 'text-[#141414]'
}

function TransactionDollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20.8 13a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
      <path d="M18 11v10" />
      <path d="M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M7 5h8" />
      <path d="M7 5v8a3 3 0 0 0 3 3h1" />
    </svg>
  )
}

function ReceiptRefundIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
      <path d="M15 14v-2a2 2 0 0 0 -2 -2h-4l2 -2m0 4l-2 -2" />
    </svg>
  )
}

function renderActivityIcon(item: ActivityHistoryItem) {
  if (item.kind === 'nokos_purchase') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3EC] text-[#E0592A]">
        <TransactionDollarIcon className="h-5 w-5" />
      </div>
    )
  }

  if (item.kind === 'nokos_refund') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#16774C]">
        <ReceiptRefundIcon className="h-5 w-5" />
      </div>
    )
  }

  return <div className="text-2xl">{item.icon || '📦'}</div>
}

function sosmedStatusLabel(status: SosmedOrder['order_status']) {
  switch (status) {
    case 'success':
      return { label: 'Selesai', className: 'bg-[#ECFDF3] text-[#16774C]' }
    case 'failed':
    case 'canceled':
    case 'expired':
      return { label: 'Butuh cek', className: 'bg-[#FFF1F2] text-[#D64545]' }
    case 'pending_payment':
      return { label: 'Menunggu bayar', className: 'bg-[#FFF7E8] text-[#B76E00]' }
    default:
      return { label: 'Diproses', className: 'bg-[#EEF5FF] text-[#2563EB]' }
  }
}

function shortCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, setWalletBalance } = useAuthStore()

  const [orders, setOrders] = useState<Order[]>([])
  const [sosmedOrders, setSosmedOrders] = useState<SosmedOrder[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentActivities, setRecentActivities] = useState<ActivityHistoryItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [dashboardLoading, setDashboardLoading] = useState(true)

  const [wallet, setWallet] = useState({ balance: 0, totalTopup: 0, totalSpent: 0 })
  const [walletLoading, setWalletLoading] = useState(true)

  useEffect(() => {
    let active = true

    Promise.allSettled([
      orderService.list({ limit: 20 }),
      sosmedOrderService.list({ page: 1, limit: 8 }),
      notificationService.myList({ page: 1, limit: 4 }),
    ]).then(([orderRes, sosmedRes, notifRes]) => {
      if (!active) return

      if (orderRes.status === 'fulfilled' && orderRes.value.success) setOrders(orderRes.value.data || [])
      if (sosmedRes.status === 'fulfilled' && sosmedRes.value.success) setSosmedOrders(sosmedRes.value.data || [])
      if (notifRes.status === 'fulfilled' && notifRes.value.success) {
        setNotifications(notifRes.value.data?.notifications || [])
        setUnreadCount(notifRes.value.data?.unread_count || 0)
      }

      setDashboardLoading(false)
    })

    return () => {
      active = false
    }
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

  const activeOrders = orders.filter((order) => order.order_status === 'active')
  const activeSosmedOrders = useMemo(
    () => sosmedOrders.filter((order) => ['pending_payment', 'processing'].includes(order.order_status)).slice(0, 3),
    [sosmedOrders]
  )
  const refillReadyCount = sosmedOrders.filter((order) => order.refill_eligible && (!order.refill_status || order.refill_status === 'none')).length
  const greetingName = user?.name?.split(' ')[0] || 'Sobat'

  const summaryCards = [
    { icon: Wallet, label: 'Saldo Wallet', value: walletLoading ? 'Memuat...' : formatRupiah(wallet.balance), accent: 'bg-[#141414] text-white' },
    { icon: Clock, label: 'Order Diproses', value: activeSosmedOrders.length, accent: 'bg-[#EEF5FF] text-[#2563EB]' },
    { icon: PackageCheck, label: 'Akun Aktif', value: activeOrders.length, accent: 'bg-[#F4F4F1] text-[#141414]' },
    { icon: Bell, label: 'Notifikasi Baru', value: unreadCount, accent: 'bg-[#FFF3EC] text-[#E0592A]' },
    { icon: ShieldCheck, label: 'Refill Siap Cek', value: refillReadyCount, accent: 'bg-[#ECFDF3] text-[#16774C]' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#E8E4DC] bg-[#141414] text-white shadow-sm">
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
          <div className="absolute right-[-80px] top-[-120px] h-64 w-64 rounded-full bg-[#FF5733]/30 blur-3xl" />
          <div className="absolute bottom-[-120px] left-[30%] h-56 w-56 rounded-full bg-[#F4C95D]/20 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-3.5 w-3.5 text-[#F4C95D]" /> Dashboard Premium Hub
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
              Halo, {greetingName}. Mau pantau order atau mulai transaksi baru?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              Semua ringkasan penting ada di sini: saldo wallet, order sosmed yang masih berjalan, notifikasi, dan aktivitas terbaru.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/product/sosmed" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF5733] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#FF5733]/25 transition hover:bg-[#e64d2e]">
                Beli Paket Sosmed <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard/wallet" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/15">
                Top Up Wallet <Plus className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.accent}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold text-white/55">{card.label}</div>
                <div className="mt-1 text-xl font-black tracking-[-0.03em]">{card.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-[24px] border border-[#EBEBEB] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#141414]">Order Sosmed Aktif</h2>
                <p className="text-sm text-[#777]">Pantau proses tanpa buka halaman detail satu-satu.</p>
              </div>
              <Link href="/dashboard/sosmed/orders" className="inline-flex items-center gap-2 text-sm font-bold text-[#FF5733] hover:underline">
                Lihat semua <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {dashboardLoading ? (
              <div className="grid gap-3">
                {[...Array(3)].map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-[#F4F4F1]" />)}
              </div>
            ) : activeSosmedOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E3DED6] bg-[#FFFCF7] p-6 text-center">
                <PackageCheck className="mx-auto mb-3 h-10 w-10 text-[#D6C9B8]" />
                <h3 className="text-base font-black text-[#141414]">Belum ada order yang berjalan</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#777]">Mulai dari paket sosmed, nanti progress order bakal tampil di sini.</p>
                <Link href="/product/sosmed" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#141414] px-4 py-2 text-sm font-bold text-white">
                  Pilih Paket <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {activeSosmedOrders.map((order) => {
                  const status = sosmedStatusLabel(order.order_status)
                  return (
                    <Link key={order.id} href={`/dashboard/sosmed/orders/${order.id}`} className="group rounded-2xl border border-[#EEEAE4] bg-[#FBFAF7] p-4 transition hover:border-[#FFB197] hover:bg-white">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-[#777]">{shortCode(order.id)}</span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span>
                          </div>
                          <h3 className="truncate text-sm font-black text-[#141414]">{order.service_title || 'Paket Sosmed'}</h3>
                          <p className="mt-1 truncate text-xs text-[#777]">Target: {order.target_link || '-'}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <div className="text-sm font-black text-[#141414]">{formatRupiah(order.total_price)}</div>
                          <div className="text-xs text-[#888]">{formatDate(order.created_at)}</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                        <div className="h-full w-2/3 rounded-full bg-[#FF5733] transition-all group-hover:w-3/4" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-[#EBEBEB] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em]">Aktivitas Terbaru</h2>
                <p className="text-sm text-[#777]">Transaksi dan update terakhir akun lu.</p>
              </div>
              <Link href="/dashboard/riwayat-order" className="text-sm font-bold text-[#FF5733] hover:underline">Lihat semua</Link>
            </div>

            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F4F4F2]" />)}
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="py-10 text-center">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-[#EBEBEB]" />
                <p className="text-sm text-[#888]">Belum ada aktivitas</p>
                <Link href="/product/sosmed" className="mt-2 inline-block text-sm font-bold text-[#FF5733] hover:underline">Belanja Sekarang →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((activity) => (
                  <Link key={activity.id} href="/dashboard/riwayat-order" className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-[#F7F7F5]">
                    <div className="flex min-w-0 items-center gap-3">
                      {renderActivityIcon(activity)}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{activity.title}</div>
                        <div className="truncate text-xs text-[#888]">{formatDate(activity.occurred_at)} • {activity.source_label}</div>
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <div className={`text-sm font-bold ${activityAmountClass(activity)}`}>{activityAmountText(activity)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <WalletCard balance={wallet.balance} totalTopup={wallet.totalTopup} totalSpent={wallet.totalSpent} loading={walletLoading} onTopUp={() => router.push('/dashboard/wallet')} />

          <section className="rounded-[24px] border border-[#EBEBEB] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black tracking-[-0.03em]">Aksi Cepat</h2>
            <div className="mt-4 grid gap-3">
              {[
                { href: '/product/sosmed', label: 'Beli Paket Sosmed', desc: 'Tambah followers, views, likes, dan paket bundling.', icon: Sparkles },
                { href: '/dashboard/sosmed/orders', label: 'Cek Order Sosmed', desc: 'Pantau status, refill, dan cancel request.', icon: RefreshCcw },
                { href: '/dashboard/wallet', label: 'Top Up Wallet', desc: 'Isi saldo buat checkout instan.', icon: Wallet },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-[#EFECE7] bg-[#FBFAF7] p-4 transition hover:border-[#FFB197] hover:bg-white">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#141414] text-white">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-[#141414]">{item.label}</div>
                    <div className="text-xs leading-5 text-[#777]">{item.desc}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#999] transition group-hover:translate-x-0.5 group-hover:text-[#FF5733]" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#EBEBEB] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black tracking-[-0.03em]">Notifikasi</h2>
              <Link href="/dashboard/notifikasi" className="text-sm font-bold text-[#FF5733] hover:underline">Buka</Link>
            </div>
            {notifications.length === 0 ? (
              <p className="rounded-2xl bg-[#F7F7F5] p-4 text-sm text-[#777]">Belum ada notifikasi baru. Nanti update penting bakal muncul di sini.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <Link key={notification.id} href="/dashboard/notifikasi" className="block rounded-2xl border border-[#EFECE7] p-3 transition hover:bg-[#FBFAF7]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF5733]" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[#141414]">{notification.title}</div>
                        <div className="line-clamp-2 text-xs leading-5 text-[#777]">{notification.message}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-[#D9F2E4] bg-[#F3FFF8] p-5 text-[#14532D]">
            <div className="mb-2 flex items-center gap-2 text-sm font-black">
              <CheckCircle className="h-4 w-4" /> Saldo aman, order kepantau
            </div>
            <p className="text-sm leading-6 text-[#287348]">Kalau provider gagal, sistem wallet punya jalur refund otomatis. Lu tetap bisa pantau status dari dashboard order.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
