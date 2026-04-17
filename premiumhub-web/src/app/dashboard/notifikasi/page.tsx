"use client"

import { useCallback, useEffect, useMemo, useState, type SVGProps } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCcw,
  ShieldBan,
  ShieldCheck,
  Wallet,
} from 'lucide-react'

import { notificationService, type NotificationItem } from '@/services/notificationService'

type NotificationFilter = 'all' | 'unread' | 'order' | 'wallet' | 'claim'
type NotificationKind = 'order' | 'wallet' | 'claim' | 'other'

const PAGE_LIMIT = 20

const FILTER_OPTIONS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'unread', label: 'Belum dibaca' },
  { key: 'order', label: 'Order' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'claim', label: 'Klaim' },
]

function TransactionDollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.8 13a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
      <path d="M18 11v10" />
      <path d="M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M7 5h8" />
      <path d="M7 5v8a3 3 0 0 0 3 3h1" />
    </svg>
  )
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response
    const message = response?.data?.message
    if (message) return message
  }

  return fallback
}

function normalizeNotificationKind(notification: NotificationItem): NotificationKind {
  const type = (notification.type || '').toLowerCase()
  const content = `${notification.title} ${notification.message}`.toLowerCase()

  if (type.includes('claim') || content.includes('klaim') || content.includes('garansi')) {
    return 'claim'
  }

  if (type.includes('wallet') || content.includes('wallet') || content.includes('topup')) {
    return 'wallet'
  }

  if (
    type.includes('order') ||
    type.includes('payment') ||
    content.includes('order') ||
    content.includes('invoice') ||
    content.includes('pembayaran') ||
    content.includes('nomor virtual')
  ) {
    return 'order'
  }

  return 'other'
}

function isClaimRejected(notification: NotificationItem) {
  const content = `${notification.title} ${notification.message}`.toLowerCase()
  return content.includes('ditolak') || content.includes('tolak')
}

function notificationKindLabel(notification: NotificationItem) {
  const kind = normalizeNotificationKind(notification)

  switch (kind) {
    case 'order':
      return 'Order'
    case 'wallet':
      return 'Wallet'
    case 'claim':
      return 'Klaim'
    default:
      return 'Info'
  }
}

function notificationTargetHref(notification: NotificationItem) {
  const kind = normalizeNotificationKind(notification)

  switch (kind) {
    case 'order':
      return '/dashboard/riwayat-order'
    case 'wallet':
      return '/dashboard/wallet'
    case 'claim':
      return '/dashboard/klaim-garansi'
    default:
      return undefined
  }
}

function formatNotificationTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  const diffMs = parsed.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (absMs < minute) {
    return 'Baru saja'
  }

  const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })

  if (absMs < hour) {
    return rtf.format(Math.round(diffMs / minute), 'minute')
  }

  if (absMs < day) {
    return rtf.format(Math.round(diffMs / hour), 'hour')
  }

  if (absMs < 7 * day) {
    return rtf.format(Math.round(diffMs / day), 'day')
  }

  return parsed.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchesFilter(notification: NotificationItem, filter: NotificationFilter) {
  if (filter === 'all') return true
  if (filter === 'unread') return !notification.is_read

  return normalizeNotificationKind(notification) === filter
}

function renderNotificationIcon(notification: NotificationItem) {
  const kind = normalizeNotificationKind(notification)

  if (kind === 'order') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF3EC] text-[#E0592A]">
        <TransactionDollarIcon className="h-5 w-5" />
      </div>
    )
  }

  if (kind === 'wallet') {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7E8] text-[#C77700]">
        <Wallet className="h-5 w-5" />
      </div>
    )
  }

  if (kind === 'claim') {
    if (isClaimRejected(notification)) {
      return (
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFEDED] text-[#D64545]">
          <ShieldBan className="h-5 w-5" />
        </div>
      )
    }

    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF3] text-[#16774C]">
        <ShieldCheck className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1] text-[#666]">
      <Bell className="h-5 w-5" />
    </div>
  )
}

export default function NotifikasiPage() {
  const router = useRouter()

  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actionID, setActionID] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const loadNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await notificationService.myList({ page, limit: PAGE_LIMIT })
        if (!res.success) {
          setError(res.message || 'Gagal memuat notifikasi')
          return
        }

        const payload = res.data || { notifications: [], unread_count: 0 }
        const notifications = payload.notifications || []

        setItems(notifications)
        setUnreadCount(payload.unread_count || 0)
        setTotal(res.meta?.total ?? notifications.length)
        setTotalPages(Math.max(1, res.meta?.total_pages ?? 1))
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat notifikasi'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [page]
  )

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const filteredItems = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter])
  const unreadInPage = useMemo(() => items.filter((item) => !item.is_read).length, [items])

  const markNotificationRead = useCallback(async (notification: NotificationItem) => {
    if (notification.is_read) return true

    setActionID(notification.id)

    try {
      const res = await notificationService.markRead(notification.id)
      if (!res.success) {
        setError(res.message || 'Gagal menandai notifikasi sebagai dibaca')
        return false
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      return true
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menandai notifikasi sebagai dibaca'))
      return false
    } finally {
      setActionID(null)
    }
  }, [])

  const openNotification = useCallback(
    async (notification: NotificationItem) => {
      const ok = await markNotificationRead(notification)
      if (!ok) return

      const targetHref = notificationTargetHref(notification)
      if (targetHref) {
        router.push(targetHref)
      }
    },
    [markNotificationRead, router]
  )

  const markAllAsRead = useCallback(async () => {
    const unreadItems = items.filter((item) => !item.is_read)
    if (!unreadItems.length) return

    setBulkLoading(true)
    setError('')

    try {
      for (const item of unreadItems) {
        const res = await notificationService.markRead(item.id)
        if (!res.success) {
          throw new Error(res.message || 'Gagal menandai semua notifikasi sebagai dibaca')
        }
      }

      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnreadCount((prev) => Math.max(0, prev - unreadItems.length))
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menandai semua notifikasi sebagai dibaca'))
    } finally {
      setBulkLoading(false)
    }
  }, [items])

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#141414]">Notifikasi</h1>
            <p className="mt-1 text-sm text-[#888]">Pantau update order, wallet, dan klaim garansi dari akun lu.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#F5D8C9] bg-[#FFF3EC] px-3 py-1 text-xs font-bold text-[#C85C2C]">
              {unreadCount} belum dibaca
            </span>

            <button
              type="button"
              onClick={() => void loadNotifications({ silent: true })}
              disabled={refreshing || loading || bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={bulkLoading || unreadInPage === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D9EEDB] bg-[#ECFDF3] px-3 py-2 text-xs font-semibold text-[#16774C] hover:bg-[#DFF8EA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Tandai semua dibaca
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === option.key
                  ? 'border-[#141414] bg-[#141414] text-white'
                  : 'border-[#E5E5E3] bg-white text-[#666] hover:bg-[#F7F7F5]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadNotifications()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Coba lagi
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-10 text-center">
          <p className="text-sm text-[#888]">
            {filter === 'all'
              ? 'Belum ada notifikasi.'
              : 'Tidak ada notifikasi untuk filter ini di halaman saat ini.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filteredItems.map((notification) => {
              const busy = actionID === notification.id
              const kindLabel = notificationKindLabel(notification)

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  disabled={busy || bulkLoading}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    notification.is_read
                      ? 'border-[#EBEBEB] bg-white hover:bg-[#FCFCFB]'
                      : 'border-[#FFE1D4] bg-[#FFF8F3] hover:bg-[#FFF4ED]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {renderNotificationIcon(notification)}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-[#141414]">{notification.title}</p>
                          {!notification.is_read ? (
                            <span className="rounded-full bg-[#141414] px-2 py-0.5 text-[10px] font-semibold text-white">baru</span>
                          ) : null}
                        </div>

                        <p className="mt-1 text-sm leading-relaxed text-[#555]">{notification.message}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#888]">
                          <span className="rounded-full bg-[#F3F3F1] px-2 py-0.5 font-semibold text-[#666]">{kindLabel}</span>
                          <span>•</span>
                          <span>{formatNotificationTime(notification.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {busy ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-[#666]" /> : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#EBEBEB] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#888]">
              Menampilkan halaman <span className="font-semibold text-[#141414]">{page}</span> dari{' '}
              <span className="font-semibold text-[#141414]">{totalPages}</span> • total {total} notifikasi
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Selanjutnya <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
