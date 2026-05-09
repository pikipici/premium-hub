"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { adminDashboardService } from '@/services/adminDashboardService'
import { claimService } from '@/services/claimService'
import type { Claim, Order } from '@/types/order'

type ChartTab = '7 Hari' | '30 Hari' | '3 Bulan'

type ProductLookup = Record<string, { name: string; icon: string }>

type StockSummary = {
  product_id: string
  name: string
  icon: string
  available: number
}

type TopProductSummary = {
  product_id: string
  name: string
  icon: string
  sold: number
  revenue: number
}

type DashboardProps = {
  onNavigate: (page: string) => void
}


function toSafeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return 0
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
}

function parseDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function addDays(value: Date, offset: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + offset)
  return startOfDay(next)
}

function dayKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(toSafeNumber(value))
}

function shortWeekday(value: Date) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(value)
}

function compactDate(value: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  }).format(value)
}

function shortOrderCode(id: string) {
  if (!id) return '-'
  if (id.startsWith('#')) return id
  return `#${id.split('-')[0]?.toUpperCase() || id}`
}

function statusMeta(order: Order) {
  if (order.payment_status === 'failed' || order.payment_status === 'expired' || order.order_status === 'failed') {
    return { label: 'Gagal', className: 's-gagal' }
  }

  if (order.order_status === 'completed') {
    return { label: 'Selesai', className: 's-proses' }
  }

  if (order.order_status === 'active') {
    return { label: 'Aktif', className: 's-lunas' }
  }

  if (order.payment_status === 'paid') {
    return { label: 'Lunas', className: 's-lunas' }
  }

  return { label: 'Pending', className: 's-pending' }
}

function reasonLabel(reason?: string | null) {
  const normalized = (reason || '').trim().toLowerCase()
  if (!normalized) return '-'

  const labels: Record<string, string> = {
    login: 'Tidak Bisa Login',
    password: 'Password Salah',
    kicked: 'Akun Dikeluarkan',
    profile: 'Masalah Profil',
    quality: 'Kualitas Buruk',
    other: 'Lainnya',
  }

  return labels[normalized] || normalized
}

function nameInitials(name: string) {
  const tokens = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!tokens.length) return 'U'
  return tokens.map((token) => token.charAt(0).toUpperCase()).join('')
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return '0%'
    return '+100%'
  }

  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function sumRevenueRange(
  revenueByDay: Record<string, number>,
  start: Date,
  end: Date
) {
  const cursor = new Date(start)
  let total = 0

  while (cursor <= end) {
    total += revenueByDay[dayKey(cursor)] || 0
    cursor.setDate(cursor.getDate() + 1)
  }

  return total
}

function buildChartSeries(tab: ChartTab, revenueByDay: Record<string, number>) {
  const today = startOfDay(new Date())

  if (tab === '7 Hari') {
    const labels: string[] = []
    const values: number[] = []

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset)
      labels.push(shortWeekday(date))
      values.push(revenueByDay[dayKey(date)] || 0)
    }

    return { labels, values }
  }

  if (tab === '30 Hari') {
    const labels: string[] = []
    const values: number[] = []

    for (let group = 9; group >= 0; group -= 1) {
      const startOffset = group * 3 + 2
      const endOffset = group * 3
      const start = addDays(today, -startOffset)
      const end = addDays(today, -endOffset)

      labels.push(`${start.getDate()}-${end.getDate()}`)
      values.push(sumRevenueRange(revenueByDay, start, end))
    }

    return { labels, values }
  }

  // 3 Bulan -> 12 minggu
  const labels: string[] = []
  const values: number[] = []

  for (let group = 11; group >= 0; group -= 1) {
    const startOffset = group * 7 + 6
    const endOffset = group * 7
    const start = addDays(today, -startOffset)
    const end = addDays(today, -endOffset)

    labels.push(compactDate(end))
    values.push(sumRevenueRange(revenueByDay, start, end))
  }

  return { labels, values }
}

function renderChart(
  target: HTMLDivElement | null,
  series: { labels: string[]; values: number[] },
  maxHeight: number
) {
  if (!target) return

  target.innerHTML = ''

  if (!series.values.length || series.values.every((value) => value <= 0)) {
    const empty = document.createElement('div')
    empty.style.fontSize = '12px'
    empty.style.color = 'var(--muted)'
    empty.textContent = 'Belum ada data transaksi di periode ini.'
    target.appendChild(empty)
    return
  }

  const maxVal = Math.max(...series.values, 1)

  series.values.forEach((value, index) => {
    const height = Math.max(12, Math.round((value / maxVal) * maxHeight))
    const isLatest = index === series.values.length - 1

    const wrap = document.createElement('div')
    wrap.className = 'bar-wrap'
    wrap.innerHTML = `
      <div class="bar ${isLatest ? 'highlight' : ''}" style="height:${height}px;background:${isLatest ? 'var(--orange)' : 'var(--bg)'};">
        <div class="chart-tooltip">${formatRupiah(value)}</div>
      </div>
      <div class="bar-label">${series.labels[index]}</div>
    `

    target.appendChild(wrap)
  })
}

export default function DashboardPage({ onNavigate }: DashboardProps) {
  const [chartActiveTab, setChartActiveTab] = useState<ChartTab>('7 Hari')
  const chartRef = useRef<HTMLDivElement>(null)
  const mobileChartRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [productLookup, setProductLookup] = useState<ProductLookup>({})
  const [ordersForAnalytics, setOrdersForAnalytics] = useState<Order[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([])
  const [pendingClaimsTotal, setPendingClaimsTotal] = useState(0)
  const [monthlyClaimsCount, setMonthlyClaimsCount] = useState(0)
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([])
  const [activeUsersTotal, setActiveUsersTotal] = useState(0)
  const [claimActionID, setClaimActionID] = useState<string | null>(null)

  const resolveProduct = useCallback(
    (order: Order) => {
      const productID = order.price?.product_id

      if (productID && productLookup[productID]) {
        return productLookup[productID]
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
    },
    [productLookup]
  )

  const getBuyerName = useCallback((order: Order) => {
    if (order.user?.name?.trim()) return order.user.name
    if (order.user_id) return `User ${order.user_id.slice(0, 8)}`
    return 'User'
  }, [])

  const getBuyerEmail = useCallback((order: Order) => {
    if (order.user?.email?.trim()) return order.user.email
    return '-'
  }, [])

  const getClaimUserName = useCallback((claim: Claim) => {
    if (claim.user?.name?.trim()) return claim.user.name

    if (claim.order?.user?.name?.trim()) return claim.order.user.name

    if (claim.user_id) return `User ${claim.user_id.slice(0, 8)}`
    return 'User'
  }, [])

  const getClaimProductLabel = useCallback((claim: Claim) => {
    const order = claim.order
    if (!order) return 'Produk'

    const product = resolveProduct(order)
    const duration = order.price?.duration

    if (!duration) {
      return `${product.icon} ${product.name}`
    }

    return `${product.icon} ${product.name} · ${duration} Bulan`
  }, [resolveProduct])

  const loadDashboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await adminDashboardService.summary()

        if (!res.success) {
          setError(res.message || 'Gagal memuat data dashboard admin')
          setProductLookup({})
          setOrdersForAnalytics([])
          setRecentOrders([])
          setPendingClaims([])
          setPendingClaimsTotal(0)
          setMonthlyClaimsCount(0)
          setStockSummary([])
          setActiveUsersTotal(0)
          return
        }

        const lookup: ProductLookup = {}
        res.data.analytics_orders.forEach((order) => {
          const productID = order.price?.product_id || order.product?.id
          if (!productID) return
          const product = order.product || { name: `Produk ${productID.slice(0, 8)}`, icon: '📦' }
          lookup[productID] = {
            name: product.name,
            icon: product.icon || '📦',
          }
        })
        res.data.stock_summary.forEach((stock) => {
          lookup[stock.product_id] = { name: stock.name, icon: stock.icon || '📦' }
        })

        setProductLookup(lookup)
        setOrdersForAnalytics(res.data.analytics_orders)
        setRecentOrders(res.data.recent_orders)
        setPendingClaims(res.data.pending_claim_rows)
        setPendingClaimsTotal(res.data.pending_claims)
        setMonthlyClaimsCount(res.data.monthly_claims_count)
        setStockSummary(res.data.stock_summary)
        setActiveUsersTotal(res.data.active_users_total)
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat data dashboard admin'))
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const paidOrders = useMemo(
    () =>
      ordersForAnalytics.filter((order) => {
        return order.payment_status === 'paid'
      }),
    [ordersForAnalytics]
  )

  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {}

    paidOrders.forEach((order) => {
      const eventDate = parseDate(order.paid_at || order.created_at)
      if (!eventDate) return

      const key = dayKey(startOfDay(eventDate))
      map[key] = (map[key] || 0) + toSafeNumber(order.total_price)
    })

    return map
  }, [paidOrders])

  const chartSeries = useMemo(
    () => buildChartSeries(chartActiveTab, revenueByDay),
    [chartActiveTab, revenueByDay]
  )

  useEffect(() => {
    renderChart(chartRef.current, chartSeries, 140)
    renderChart(mobileChartRef.current, chartSeries, 92)
  }, [chartSeries])

  const kpi = useMemo(() => {
    const today = startOfDay(new Date())
    const yesterday = addDays(today, -1)
    const monthStart = startOfMonth(today)

    const revenueToday = revenueByDay[dayKey(today)] || 0
    const revenueYesterday = revenueByDay[dayKey(yesterday)] || 0

    const ordersToday = ordersForAnalytics.filter((order) => {
      const createdAt = parseDate(order.created_at)
      if (!createdAt) return false
      return dayKey(startOfDay(createdAt)) === dayKey(today)
    }).length

    const ordersYesterday = ordersForAnalytics.filter((order) => {
      const createdAt = parseDate(order.created_at)
      if (!createdAt) return false
      return dayKey(startOfDay(createdAt)) === dayKey(yesterday)
    }).length

    const monthRevenue = paidOrders.reduce((total, order) => {
      const paidAt = parseDate(order.paid_at || order.created_at)
      if (!paidAt || paidAt < monthStart) return total
      return total + toSafeNumber(order.total_price)
    }, 0)

    const monthOrders = ordersForAnalytics.reduce((total, order) => {
      const createdAt = parseDate(order.created_at)
      if (!createdAt || createdAt < monthStart) return total
      return total + 1
    }, 0)

    const claimRate = monthOrders > 0 ? (monthlyClaimsCount / monthOrders) * 100 : 0

    return {
      revenueToday,
      revenueYesterday,
      revenueChangeText: formatPercentChange(revenueToday, revenueYesterday),
      ordersToday,
      ordersYesterday,
      ordersDelta: ordersToday - ordersYesterday,
      monthRevenue,
      monthOrders,
      claimRate,
    }
  }, [monthlyClaimsCount, ordersForAnalytics, paidOrders, revenueByDay])

  const topProducts = useMemo<TopProductSummary[]>(() => {
    const map = new Map<string, TopProductSummary>()
    const cutoff = addDays(startOfDay(new Date()), -90)

    paidOrders.forEach((order) => {
      const paidAt = parseDate(order.paid_at || order.created_at)
      if (!paidAt || paidAt < cutoff) return

      const productID = order.price?.product_id || order.product?.id
      if (!productID) return

      const info = productLookup[productID] || {
        name: order.product?.name || `Produk ${productID.slice(0, 8)}`,
        icon: order.product?.icon || '📦',
      }

      const existing = map.get(productID)
      if (!existing) {
        map.set(productID, {
          product_id: productID,
          name: info.name,
          icon: info.icon,
          sold: 1,
          revenue: toSafeNumber(order.total_price),
        })
        return
      }

      existing.sold += 1
      existing.revenue += toSafeNumber(order.total_price)
    })

    return Array.from(map.values())
      .sort((left, right) => {
        if (left.sold !== right.sold) {
          return right.sold - left.sold
        }
        return right.revenue - left.revenue
      })
      .slice(0, 5)
  }, [paidOrders, productLookup])

  const criticalStocks = useMemo(
    () => stockSummary.filter((item) => item.available <= 3).slice(0, 3),
    [stockSummary]
  )

  const stockList = useMemo(() => stockSummary.slice(0, 5), [stockSummary])

  const stockBarMax = useMemo(() => {
    if (!stockList.length) return 1
    return Math.max(...stockList.map((item) => item.available), 1)
  }, [stockList])

  const handleClaimAction = async (claim: Claim, action: 'approve' | 'reject') => {
    setClaimActionID(claim.id)
    setError('')

    try {
      const payload =
        action === 'approve'
          ? { admin_note: 'Disetujui melalui dashboard admin.' }
          : { admin_note: 'Ditolak melalui dashboard admin.' }

      const res =
        action === 'approve'
          ? await claimService.adminApprove(claim.id, payload)
          : await claimService.adminReject(claim.id, payload)

      if (!res.success) {
        setError(res.message || 'Gagal memproses klaim')
        return
      }

      setNotice(
        action === 'approve'
          ? `Klaim ${shortOrderCode(claim.id)} berhasil disetujui.`
          : `Klaim ${shortOrderCode(claim.id)} berhasil ditolak.`
      )

      await loadDashboard({ silent: true })
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memproses klaim garansi'))
    } finally {
      setClaimActionID(null)
    }
  }

  const renderStockMeta = (available: number) => {
    if (available <= 3) {
      return { sub: '⚠ Stok kritis', color: '#EF4444' }
    }

    if (available <= 7) {
      return { sub: `${available} akun tersedia (waspada)`, color: '#F59E0B' }
    }

    return { sub: `${available} akun tersedia`, color: '#22C55E' }
  }

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar" style={{ marginBottom: 12 }}>
          ✅ <strong>{notice}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setNotice('')}
          >
            tutup
          </button>
        </div>
      )}

      {!!error && (
        <div
          className="alert-bar"
          style={{
            marginBottom: 12,
            background: '#FEF2F2',
            borderColor: '#FECACA',
            color: '#991B1B',
          }}
        >
          ⚠️ <strong>{error}</strong>
        </div>
      )}

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Ringkasan Hari Ini</div>
            <div className="mobile-page-subtitle">Data real-time panel admin</div>
          </div>
          <button className="mobile-chip-btn primary" onClick={() => onNavigate('order')}>
            Lihat Order
          </button>
        </div>

        <div className="mobile-kpi-grid">
          <div className="mobile-kpi-card">
            <div className="mobile-kpi-label">Pendapatan Hari Ini</div>
            <div className="mobile-kpi-value">{formatRupiah(kpi.revenueToday)}</div>
            <div className={`mobile-kpi-change ${kpi.revenueToday >= kpi.revenueYesterday ? 'up' : 'warn'}`}>
              {kpi.revenueToday >= kpi.revenueYesterday ? '↑' : '↓'} {kpi.revenueChangeText}
            </div>
          </div>
          <div className="mobile-kpi-card">
            <div className="mobile-kpi-label">Order Baru</div>
            <div className="mobile-kpi-value">{kpi.ordersToday}</div>
            <div className={`mobile-kpi-change ${kpi.ordersDelta >= 0 ? 'up' : 'warn'}`}>
              {kpi.ordersDelta >= 0 ? '↑' : '↓'} {Math.abs(kpi.ordersDelta)} vs kemarin
            </div>
          </div>
          <div className="mobile-kpi-card">
            <div className="mobile-kpi-label">Klaim Pending</div>
            <div className="mobile-kpi-value">{pendingClaimsTotal}</div>
            <div className="mobile-kpi-change warn">Perlu action admin</div>
          </div>
          <div className="mobile-kpi-card">
            <div className="mobile-kpi-label">Pengguna Aktif</div>
            <div className="mobile-kpi-value">{activeUsersTotal.toLocaleString('id-ID')}</div>
            <div className="mobile-kpi-change up">User aktif terverifikasi</div>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 10 }}>
          <div className="mobile-card-head" style={{ marginBottom: 6 }}>
            <div>
              <div className="mobile-card-title">Grafik Pendapatan</div>
              <div className="mobile-card-sub">Trend {chartActiveTab.toLowerCase()}</div>
            </div>
            <button className="mobile-chip-btn" onClick={() => loadDashboard({ silent: true })} disabled={loading || syncing}>
              {syncing ? 'Sync...' : 'Refresh'}
            </button>
          </div>
          <div className="chart-tabs mobile-chart-tabs">
            <button className={`chart-tab${chartActiveTab === '7 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('7 Hari')}>7 Hari</button>
            <button className={`chart-tab${chartActiveTab === '30 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('30 Hari')}>30 Hari</button>
            <button className={`chart-tab${chartActiveTab === '3 Bulan' ? ' active' : ''}`} onClick={() => setChartActiveTab('3 Bulan')}>3 Bulan</button>
          </div>
          <div className="chart-wrap mobile-chart-wrap">
            <div className="chart-area mobile-chart-area" ref={mobileChartRef} />
          </div>
        </div>

        <div className="mobile-quick-grid">
          <button className="mobile-quick-btn" onClick={() => onNavigate('order')}><strong>Order</strong><span>Kelola transaksi</span></button>
          <button className="mobile-quick-btn" onClick={() => onNavigate('convert')}><strong>Convert</strong><span>Kontrol fee & queue</span></button>
          <button className="mobile-quick-btn" onClick={() => onNavigate('stok')}><strong>Stok</strong><span>Cek stok kritis</span></button>
          <button className="mobile-quick-btn" onClick={() => onNavigate('garansi')}><strong>Garansi</strong><span>Proses klaim</span></button>
          <button className="mobile-quick-btn" onClick={() => onNavigate('produk')}><strong>Produk</strong><span>Edit katalog</span></button>
        </div>

        <div className="mobile-card-list">
          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">Stok Kritis</div>
                <div className="mobile-card-sub">Perlu restock prioritas</div>
              </div>
              <span className={`status-badge ${criticalStocks.length > 0 ? 's-gagal' : 's-lunas'}`}>
                {criticalStocks.length > 0 ? `${criticalStocks.length} Item` : 'Aman'}
              </span>
            </div>
            {criticalStocks.length === 0 ? (
              <div style={{ padding: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
                Belum ada produk dengan stok kritis.
              </div>
            ) : (
              criticalStocks.map((item) => (
                <div className="mobile-card-row" key={item.product_id}>
                  <span className="mobile-card-label">{item.icon} {item.name}</span>
                  <span className="mobile-card-value">{item.available} akun</span>
                </div>
              ))
            )}
          </article>

          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">Order Terbaru</div>
                <div className="mobile-card-sub">Update real-time</div>
              </div>
            </div>
            {recentOrders.length === 0 ? (
              <div style={{ padding: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
                Belum ada order terbaru.
              </div>
            ) : (
              recentOrders.slice(0, 3).map((order) => {
                const product = resolveProduct(order)
                return (
                  <div className="mobile-card-row" key={order.id}>
                    <span className="mobile-card-label">{shortOrderCode(order.id)} · {product.icon} {product.name}</span>
                    <span className="mobile-card-value">{formatRupiah(order.total_price || 0)}</span>
                  </div>
                )
              })
            )}
            <div className="mobile-card-actions" style={{ marginTop: 8 }}>
              <button className="action-btn" onClick={() => onNavigate('order')}>Lihat Semua</button>
            </div>
          </article>
        </div>
      </div>

      <div className="admin-desktop-only">
        <div className="alert-bar">
          {criticalStocks.length > 0 ? (
            <>
              ⚠️ <strong>{criticalStocks.length} produk stok kritis</strong> —{' '}
              {criticalStocks.map((item) => `${item.name} (${item.available})`).join(', ')}.
              <a onClick={() => onNavigate('stok')}>Tambah stok sekarang →</a>
            </>
          ) : (
            <>
              ✅ <strong>Tidak ada stok kritis</strong> — semua produk memiliki stok aman.
              <a onClick={() => onNavigate('stok')}>Cek detail stok →</a>
            </>
          )}
        </div>

        <div className="metrics">
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Pendapatan Hari Ini</span><div className="metric-icon green">💰</div></div>
            <div className="metric-value">{formatRupiah(kpi.revenueToday)}</div>
            <div className={`metric-change ${kpi.revenueToday >= kpi.revenueYesterday ? 'up' : 'warn'}`}>
              {kpi.revenueToday >= kpi.revenueYesterday ? '↑' : '↓'} {kpi.revenueChangeText} vs kemarin
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Order Baru</span><div className="metric-icon orange">🛒</div></div>
            <div className="metric-value">{kpi.ordersToday}</div>
            <div className={`metric-change ${kpi.ordersDelta >= 0 ? 'up' : 'warn'}`}>
              {kpi.ordersDelta >= 0 ? '↑' : '↓'} {Math.abs(kpi.ordersDelta)} dari kemarin
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Klaim Garansi</span><div className="metric-icon red">🛡</div></div>
            <div className="metric-value">{pendingClaimsTotal}</div>
            <div className="metric-change warn">⚠ Menunggu proses</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Pengguna Aktif</span><div className="metric-icon blue">👥</div></div>
            <div className="metric-value">{activeUsersTotal.toLocaleString('id-ID')}</div>
            <div className="metric-change up">Akun aktif terverifikasi</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-header">
              <h2>Pendapatan</h2>
              <div className="card-header-right">
                <div className="chart-tabs">
                  <button className={`chart-tab${chartActiveTab === '7 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('7 Hari')}>7 Hari</button>
                  <button className={`chart-tab${chartActiveTab === '30 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('30 Hari')}>30 Hari</button>
                  <button className={`chart-tab${chartActiveTab === '3 Bulan' ? ' active' : ''}`} onClick={() => setChartActiveTab('3 Bulan')}>3 Bulan</button>
                </div>
                <button className="link-btn" onClick={() => loadDashboard({ silent: true })}>
                  {syncing ? 'Sync...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="chart-wrap">
              <div className="chart-area" ref={chartRef} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Ringkasan Bulan Ini</h2></div>
            <div className="mini-stats">
              <div className="mini-stat">
                <div className="mini-stat-label">Total Pendapatan</div>
                <div className="mini-stat-value">{formatRupiah(kpi.monthRevenue)}</div>
                <div className="mini-stat-sub">Data transaksi paid bulan berjalan</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Total Order</div>
                <div className="mini-stat-value">{kpi.monthOrders.toLocaleString('id-ID')}</div>
                <div className="mini-stat-sub">Order yang dibuat bulan ini</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-label">Rate Klaim Garansi</div>
                <div className="mini-stat-value">{kpi.claimRate.toFixed(1)}%</div>
                <div className={`mini-stat-sub ${kpi.claimRate >= 5 ? 'warn' : ''}`}>
                  {monthlyClaimsCount} klaim dari {kpi.monthOrders || 0} order bulan ini
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-header"><h2>Order Terbaru</h2><div className="card-header-right"><button className="link-btn" onClick={() => onNavigate('order')}>Lihat semua →</button></div></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order</th><th>Pembeli</th><th>Produk</th><th>Total</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>
                        Memuat order terbaru...
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>
                        Belum ada data order.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => {
                      const product = resolveProduct(order)
                      const status = statusMeta(order)

                      return (
                        <tr key={order.id}>
                          <td><div className="order-id">{shortOrderCode(order.id)}</div></td>
                          <td><div className="order-buyer">{getBuyerName(order)}</div><div className="order-email">{getBuyerEmail(order)}</div></td>
                          <td><span className="product-pill">{product.icon} {product.name}</span></td>
                          <td style={{ fontWeight: 600 }}>{formatRupiah(order.total_price || 0)}</td>
                          <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                          <td>
                            <button
                              className={`action-btn${order.payment_status === 'pending' ? ' orange' : ''}`}
                              onClick={() => onNavigate('order')}
                            >
                              {order.payment_status === 'pending' ? 'Konfirmasi' : 'Detail'}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Status Stok</h2><button className="link-btn" onClick={() => onNavigate('stok')}>Kelola →</button></div>
            <div className="stok-list">
              {stockList.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>Belum ada data stok tersedia.</div>
              ) : (
                stockList.map((item) => {
                  const meta = renderStockMeta(item.available)
                  const width = Math.max(6, Math.round((item.available / stockBarMax) * 100))

                  return (
                    <div className="stok-item" key={item.product_id}>
                      <div className="stok-icon">{item.icon}</div>
                      <div className="stok-info">
                        <div className="stok-name">{item.name}</div>
                        <div className="stok-meta">{meta.sub}</div>
                      </div>
                      <div className="stok-bar-wrap">
                        <div className="stok-bar-bg">
                          <div className="stok-bar-fill" style={{ width: `${width}%`, background: meta.color }} />
                        </div>
                        <div className="stok-count" style={{ color: meta.color }}>{item.available}</div>
                      </div>
                      <button
                        className="stok-add-btn"
                        style={item.available <= 3 ? { borderColor: meta.color, color: meta.color } : undefined}
                        onClick={() => onNavigate('stok')}
                      >
                        {item.available <= 3 ? '+ Segera' : '+ Tambah'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid-2-eq">
          <div className="card">
            <div className="card-header"><h2>Klaim Garansi Pending</h2><button className="link-btn" onClick={() => onNavigate('garansi')}>Lihat semua →</button></div>
            <div className="garansi-list">
              {pendingClaims.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                  Tidak ada klaim pending saat ini.
                </div>
              ) : (
                pendingClaims.slice(0, 3).map((claim, index) => {
                  const name = getClaimUserName(claim)
                  const initials = nameInitials(name)
                  const colorPalettes = [
                    { bg: '#DBEAFE', fg: '#1E40AF' },
                    { bg: '#FCE7F3', fg: '#9D174D' },
                    { bg: '#DCFCE7', fg: '#166534' },
                  ]
                  const palette = colorPalettes[index % colorPalettes.length]

                  return (
                    <div className="garansi-item" key={claim.id}>
                      <div className="garansi-avatar" style={{ background: palette.bg, color: palette.fg }}>{initials}</div>
                      <div className="garansi-info">
                        <div className="garansi-name">{name}</div>
                        <div className="garansi-detail">{getClaimProductLabel(claim)} · &quot;{reasonLabel(claim.reason)}&quot;</div>
                      </div>
                      <div className="garansi-actions">
                        <button
                          className="g-approve"
                          disabled={claimActionID === claim.id}
                          onClick={() => handleClaimAction(claim, 'approve')}
                        >
                          {claimActionID === claim.id ? '...' : '✓ Setujui'}
                        </button>
                        <button
                          className="g-reject"
                          disabled={claimActionID === claim.id}
                          onClick={() => handleClaimAction(claim, 'reject')}
                        >
                          {claimActionID === claim.id ? '...' : '✕ Tolak'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>Produk Terlaris (90 Hari)</h2></div>
            <div className="top-prod-list">
              {topProducts.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)' }}>
                  Belum ada data produk terlaris.
                </div>
              ) : (
                topProducts.map((item, index) => {
                  const rank = index + 1
                  return (
                    <div className="top-prod-item" key={item.product_id}>
                      <div className={`top-prod-rank${rank <= 3 ? ` rank-${rank}` : ''}`}>{rank}</div>
                      <div className="top-prod-icon">{item.icon}</div>
                      <div className="top-prod-info">
                        <div className="top-prod-name">{item.name}</div>
                        <div className="top-prod-sales">{item.sold.toLocaleString('id-ID')} terjual</div>
                      </div>
                      <div className="top-prod-rev">{formatRupiah(item.revenue)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
