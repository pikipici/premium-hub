"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, PackageOpen, RefreshCw, ShoppingBag } from 'lucide-react'

import { orderService } from '@/services/orderService'
import { productService } from '@/services/productService'
import type { Order } from '@/types/order'

type ProductLookup = Record<string, { name: string; icon: string }>

const ORDER_PAGE_LIMIT = 50
const MAX_ORDER_PAGES = 10

function shortOrderCode(id: string) {
  if (!id) return '-'
  const token = id.split('-')[0]
  return `#${(token || id).toUpperCase()}`
}

function formatDateTime(date?: string | null) {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function daysUntilExpiry(date?: string | null) {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null

  const msDiff = parsed.getTime() - Date.now()
  return Math.ceil(msDiff / (24 * 60 * 60 * 1000))
}

function accountTypeLabel(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized) return '-'
  if (normalized === 'shared') return 'Shared'
  if (normalized === 'private') return 'Private'

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

export default function AkunAktifPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [orders, setOrders] = useState<Order[]>([])
  const [productsByID, setProductsByID] = useState<ProductLookup>({})
  const [copiedKey, setCopiedKey] = useState('')

  const loadProducts = useCallback(async () => {
    try {
      const res = await productService.list({ page: 1, limit: 200 })
      if (!res.success) return

      const mapped = res.data.reduce<ProductLookup>((acc, item) => {
        acc[item.id] = { name: item.name, icon: item.icon || '📦' }
        return acc
      }, {})

      setProductsByID(mapped)
    } catch {
      // best effort: fallback ke product_id dari order
    }
  }, [])

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const collected: Order[] = []
      let currentPage = 1
      let totalPages = 1

      while (currentPage <= totalPages && currentPage <= MAX_ORDER_PAGES) {
        const res = await orderService.list({ page: currentPage, limit: ORDER_PAGE_LIMIT })
        if (!res.success) {
          setError(res.message || 'Gagal memuat daftar akun aktif')
          return
        }

        collected.push(...res.data)
        totalPages = Math.max(1, res.meta?.total_pages ?? 1)

        if (currentPage >= totalPages) break
        currentPage += 1
      }

      setOrders(collected)
    } catch {
      setError('Gagal memuat daftar akun aktif')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadProducts(), loadOrders()])
  }, [loadOrders, loadProducts])

  const activeOrders = useMemo(() => {
    return orders
      .filter((item) => item.order_status === 'active' && item.payment_status === 'paid')
      .sort((a, b) => {
        const left = new Date(b.paid_at || b.created_at).getTime()
        const right = new Date(a.paid_at || a.created_at).getTime()
        return left - right
      })
  }, [orders])

  const copyText = async (value: string, key: string) => {
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? '' : prev))
      }, 1800)
    } catch {
      // ignore clipboard error
    }
  }

  const resolveProduct = (order: Order) => {
    const productID = order.price?.product_id || ''

    if (productID && productsByID[productID]) {
      return productsByID[productID]
    }

    if (order.product?.name) {
      return {
        name: order.product.name,
        icon: order.product.icon || '📦',
      }
    }

    return {
      name: productID ? `Produk ${productID.slice(0, 8)}` : 'Produk',
      icon: order.product?.icon || '📦',
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Akun Aktif</h1>
          <p className="mt-1 text-sm text-[#888]">Daftar akun premium yang sudah aktif dari pembelian lu.</p>
        </div>

        <button
          type="button"
          onClick={() => void loadOrders({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E2E2E2] bg-white px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, idx) => (
            <div key={idx} className="h-40 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Loader2 className="h-3.5 w-3.5" /> Coba lagi
          </button>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="rounded-2xl border border-[#EBEBEB] bg-white px-6 py-12 text-center">
          <PackageOpen className="mx-auto mb-3 h-10 w-10 text-[#D1D1CD]" />
          <p className="text-sm font-semibold text-[#444]">Belum ada akun aktif.</p>
          <p className="mt-1 text-xs text-[#888]">Kalau order lu sudah lunas, akun bakal muncul otomatis di sini.</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/product/prem-apps"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF5733] px-4 py-2 text-xs font-bold text-white hover:bg-[#e64d2e]"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Belanja Produk
            </Link>
            <Link
              href="/dashboard/riwayat-order"
              className="inline-flex items-center rounded-full border border-[#E2E2E2] px-4 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
            >
              Lihat Riwayat
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeOrders.map((order) => {
            const product = resolveProduct(order)
            const expiryDays = daysUntilExpiry(order.expires_at)
            const expiryBadgeClass =
              expiryDays === null
                ? 'bg-[#F1F1EE] text-[#666]'
                : expiryDays <= 0
                  ? 'bg-red-100 text-red-700'
                  : expiryDays <= 3
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
            const expiryLabel =
              expiryDays === null
                ? 'Tanpa tanggal expired'
                : expiryDays <= 0
                  ? 'Sudah expired'
                  : `Sisa ${expiryDays} hari`

            const accountType = accountTypeLabel(order.price?.account_type)
            const stockEmail = order.stock?.email || '-'
            const profileName = order.stock?.profile_name || '-'
            const startedAt = order.paid_at || order.created_at

            return (
              <div key={order.id} className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="text-3xl leading-none">{product.icon || '📦'}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-[#141414]">{product.name}</div>
                      <div className="mt-1 text-xs text-[#888]">{shortOrderCode(order.id)} • {accountType} • {order.price?.duration || '-'} Bulan</div>
                      <div className="mt-1 text-xs text-[#888]">Aktif sejak {formatDateTime(startedAt)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${expiryBadgeClass}`}>{expiryLabel}</span>
                    <span className="rounded-full bg-[#ECFDF3] px-2.5 py-1 text-[10px] font-bold text-[#16774C]">Aktif</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#F7F7F5] p-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#777]">Email akun</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#141414]">{stockEmail}</span>
                      <button
                        type="button"
                        onClick={() => void copyText(stockEmail, `${order.id}:email`)}
                        disabled={stockEmail === '-'}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E1E1DE] bg-white text-[#666] hover:bg-[#F1F1EE] disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Copy email akun"
                      >
                        {copiedKey === `${order.id}:email` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#F7F7F5] p-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#777]">Profile</div>
                    <div className="truncate text-sm font-semibold text-[#141414]">{profileName}</div>
                  </div>

                  <div className="rounded-xl bg-[#F7F7F5] p-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#777]">Expired</div>
                    <div className="text-sm font-semibold text-[#141414]">{formatDateTime(order.expires_at)}</div>
                  </div>

                  <div className="rounded-xl bg-[#F7F7F5] p-3">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#777]">Order ID</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#141414]">{order.id}</span>
                      <button
                        type="button"
                        onClick={() => void copyText(order.id, `${order.id}:id`)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E1E1DE] bg-white text-[#666] hover:bg-[#F1F1EE]"
                        aria-label="Copy order id"
                      >
                        {copiedKey === `${order.id}:id` ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {!order.stock ? (
                  <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-yellow-50 px-2.5 py-1 text-[11px] font-semibold text-yellow-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Akun belum ter-assign. Hubungi admin kalau status ini bertahan lama.
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
