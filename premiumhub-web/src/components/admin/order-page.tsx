"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { accountTypeService } from '@/services/accountTypeService'
import { orderService, type AdminOrderStatus } from '@/services/orderService'
import { productService } from '@/services/productService'
import type { AccountType } from '@/types/accountType'
import type { Order } from '@/types/order'

type OrderFilter = 'all' | AdminOrderStatus

type ProductLookup = Record<string, { name: string; icon: string }>

const PAGE_LIMIT = 20

const FALLBACK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  shared: 'Shared · Akun Bersama',
  private: 'Private · Akun Pribadi',
}

const STATUS_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Aktif' },
  { value: 'completed', label: 'Selesai' },
  { value: 'failed', label: 'Gagal' },
]

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'

  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function shortOrderCode(id: string) {
  if (!id) return '-'
  if (id.startsWith('#')) return id
  return `#${id.split('-')[0]?.toUpperCase() || id}`
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
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

function paymentStatusLabel(value: Order['payment_status']) {
  if (value === 'paid') return 'Paid'
  if (value === 'failed') return 'Failed'
  if (value === 'expired') return 'Expired'
  return 'Pending'
}

function orderStatusLabel(value: Order['order_status']) {
  if (value === 'active') return 'Active'
  if (value === 'completed') return 'Completed'
  if (value === 'failed') return 'Failed'
  return 'Pending'
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

function normalizeAccountTypeCode(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function formatAccountTypeLabel(code?: string | null, accountTypeLookup?: Record<string, AccountType>) {
  const normalized = normalizeAccountTypeCode(code)
  if (!normalized) return '-'

  const configured = accountTypeLookup?.[normalized]
  if (configured?.label?.trim()) {
    return configured.label.trim()
  }

  const fallback = FALLBACK_ACCOUNT_TYPE_LABELS[normalized]
  if (fallback) return fallback

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

function accountPackage(order: Order, accountTypeLookup?: Record<string, AccountType>) {
  const duration = order.price?.duration
  const accountType = formatAccountTypeLabel(order.price?.account_type, accountTypeLookup)

  if (!duration && accountType === '-') return '-'
  if (!duration) return accountType
  if (accountType === '-') return `${duration} Bulan`

  return `${duration} Bulan · ${accountType}`
}

const MODAL_OVERLAY_STYLE = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(15, 23, 42, 0.48)',
  backdropFilter: 'blur(2px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
}

const MODAL_CARD_STYLE = {
  width: '100%',
  maxWidth: 560,
  maxHeight: '90vh',
  overflow: 'auto' as const,
  borderRadius: 16,
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
}

export default function OrderPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [productsByID, setProductsByID] = useState<ProductLookup>({})
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [actionOrderID, setActionOrderID] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderFilter>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const accountTypeLookup = useMemo(() => {
    return accountTypes.reduce<Record<string, AccountType>>((acc, item) => {
      const code = normalizeAccountTypeCode(item.code)
      if (!code) return acc
      acc[code] = item
      return acc
    }, {})
  }, [accountTypes])

  const resolveProduct = useCallback(
    (order: Order) => {
      const productID = order.price?.product_id
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
    },
    [productsByID]
  )

  const getBuyerName = (order: Order) => {
    if (order.user?.name?.trim()) return order.user.name
    if (order.user_id) return `User ${order.user_id.slice(0, 8)}`
    return 'User'
  }

  const getBuyerEmail = (order: Order) => {
    if (order.user?.email?.trim()) return order.user.email
    return '-'
  }

  const loadProductLookup = useCallback(async () => {
    try {
      const res = await productService.adminList({ page: 1, limit: 200 })
      if (!res.success) return

      const mapped = res.data.reduce<ProductLookup>((acc, product) => {
        acc[product.id] = {
          name: product.name,
          icon: product.icon || '📦',
        }
        return acc
      }, {})

      setProductsByID(mapped)
    } catch {
      // best effort only
    }
  }, [])

  const loadAccountTypes = useCallback(async () => {
    try {
      const res = await accountTypeService.adminList({ include_inactive: true })
      if (!res.success) return
      setAccountTypes(res.data || [])
    } catch {
      // best effort only; fallback labels still work
    }
  }, [])

  const loadOrders = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await orderService.adminList({
          page,
          limit: PAGE_LIMIT,
          status: statusFilter === 'all' ? undefined : statusFilter,
        })

        if (!res.success) {
          setError(res.message || 'Gagal memuat daftar order')
          return
        }

        setOrders(res.data)

        const totalData = res.meta?.total ?? res.data.length
        const resolvedTotalPages = Math.max(1, res.meta?.total_pages ?? 1)

        setTotal(totalData)
        setTotalPages(resolvedTotalPages)

        if (page > resolvedTotalPages) {
          setPage(resolvedTotalPages)
        }
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat daftar order admin'))
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    [page, statusFilter]
  )

  useEffect(() => {
    void Promise.all([loadProductLookup(), loadAccountTypes()])
  }, [loadAccountTypes, loadProductLookup])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!selectedOrder) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedOrder(null)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedOrder])

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return orders

    return orders.filter((order) => {
      const product = resolveProduct(order)

      const haystack = [
        shortOrderCode(order.id),
        order.id,
        getBuyerName(order),
        getBuyerEmail(order),
        product.name,
        order.price?.account_type || '',
        formatAccountTypeLabel(order.price?.account_type, accountTypeLookup),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [accountTypeLookup, orders, resolveProduct, search])

  const refreshOrders = async () => {
    await loadOrders({ silent: true })
  }

  const handleFilterChange = (value: OrderFilter) => {
    setStatusFilter(value)
    setPage(1)
  }

  const runOrderAction = async (order: Order, action: 'confirm' | 'send') => {
    setActionOrderID(order.id)
    setError('')

    try {
      const res = action === 'confirm'
        ? await orderService.adminConfirm(order.id)
        : await orderService.adminSendAccount(order.id)

      if (!res.success) {
        setError(res.message || 'Aksi order gagal dijalankan')
        return
      }

      const orderCode = shortOrderCode(order.id)
      setNotice(
        action === 'confirm'
          ? `Order ${orderCode} berhasil dikonfirmasi.`
          : `Order ${orderCode} berhasil dikirim akun.`
      )

      await refreshOrders()
    } catch (err) {
      setError(
        mapErrorMessage(
          err,
          action === 'confirm' ? 'Konfirmasi order gagal' : 'Kirim akun gagal'
        )
      )
    } finally {
      setActionOrderID(null)
    }
  }

  const exportCurrentRows = () => {
    if (filteredOrders.length === 0) {
      setError('Tidak ada data order di halaman ini untuk diexport.')
      return
    }

    const header = ['order_code', 'buyer_name', 'buyer_email', 'product', 'paket', 'total', 'payment_status', 'order_status', 'tanggal_order']

    const rows = filteredOrders.map((order) => {
      const product = resolveProduct(order)
      return [
        shortOrderCode(order.id),
        getBuyerName(order),
        getBuyerEmail(order),
        product.name,
        accountPackage(order, accountTypeLookup),
        String(order.total_price || 0),
        paymentStatusLabel(order.payment_status),
        orderStatusLabel(order.order_status),
        formatDate(order.created_at),
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map((col) => escapeCsvValue(col)).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const href = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `admin-orders-page-${page}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    URL.revokeObjectURL(href)
    setNotice('Export CSV selesai untuk data order di halaman aktif.')
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

      <div className="admin-desktop-only">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔍 Cari order / pembeli / produk..."
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 280,
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) => handleFilterChange(event.target.value as OrderFilter)}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
              }}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="topbar-btn" onClick={refreshOrders} disabled={loading || syncing}>
              {syncing ? 'Menyegarkan...' : 'Refresh'}
            </button>
            <button className="topbar-btn" onClick={exportCurrentRows} disabled={loading || syncing}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Semua Order</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total: <strong style={{ color: 'var(--dark)' }}>{total}</strong> order
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Pembeli</th>
                  <th>Produk</th>
                  <th>Paket</th>
                  <th>Total</th>
                  <th>Tgl Order</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat daftar order...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Tidak ada order untuk filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const product = resolveProduct(order)
                    const buyerName = getBuyerName(order)
                    const buyerEmail = getBuyerEmail(order)
                    const currentStatus = statusMeta(order)
                    const isRunning = actionOrderID === order.id

                    const canConfirm = order.payment_status === 'pending' && order.order_status === 'pending'
                    const canSendAccount =
                      (order.payment_status === 'paid' || order.order_status === 'active') &&
                      !order.stock_id

                    return (
                      <tr key={order.id}>
                        <td>
                          <div className="order-id">{shortOrderCode(order.id)}</div>
                        </td>
                        <td>
                          <div className="order-buyer">{buyerName}</div>
                          <div className="order-email">{buyerEmail}</div>
                        </td>
                        <td>
                          <span className="product-pill">
                            {product.icon} {product.name}
                          </span>
                        </td>
                        <td>{accountPackage(order, accountTypeLookup)}</td>
                        <td style={{ fontWeight: 600 }}>{formatRupiah(order.total_price || 0)}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{formatDate(order.created_at)}</td>
                        <td>
                          <span className={`status-badge ${currentStatus.className}`}>{currentStatus.label}</span>
                          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
                            pay:{paymentStatusLabel(order.payment_status)} · order:{orderStatusLabel(order.order_status)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => setSelectedOrder(order)}>
                              Detail
                            </button>

                            {canConfirm && (
                              <button
                                className="action-btn orange"
                                disabled={isRunning}
                                onClick={() => runOrderAction(order, 'confirm')}
                              >
                                {isRunning ? 'Memproses...' : 'Konfirmasi'}
                              </button>
                            )}

                            {!canConfirm && canSendAccount && (
                              <button
                                className="action-btn orange"
                                disabled={isRunning}
                                onClick={() => runOrderAction(order, 'send')}
                              >
                                {isRunning ? 'Memproses...' : 'Kirim Akun'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Menampilkan <strong style={{ color: 'var(--dark)' }}>{filteredOrders.length}</strong> item · Page{' '}
              <strong style={{ color: 'var(--dark)' }}>{page}</strong> /{' '}
              <strong style={{ color: 'var(--dark)' }}>{totalPages}</strong>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="topbar-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading || syncing}
              >
                Sebelumnya
              </button>
              <button
                className="topbar-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading || syncing}
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Order Masuk</div>
            <div className="mobile-page-subtitle">Pantau transaksi harian</div>
          </div>
          <div className="mobile-inline-actions">
            <button className="mobile-chip-btn" onClick={refreshOrders} disabled={loading || syncing}>
              {syncing ? 'Sync...' : 'Refresh'}
            </button>
            <button className="mobile-chip-btn" onClick={exportCurrentRows} disabled={loading || syncing}>
              Export
            </button>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari order / pembeli / produk"
            />

            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => handleFilterChange(event.target.value as OrderFilter)}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Memuat daftar order...</div>
            </article>
          ) : filteredOrders.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada order pada filter ini.</div>
            </article>
          ) : (
            filteredOrders.map((order) => {
              const product = resolveProduct(order)
              const currentStatus = statusMeta(order)
              const isRunning = actionOrderID === order.id

              const canConfirm = order.payment_status === 'pending' && order.order_status === 'pending'
              const canSendAccount =
                (order.payment_status === 'paid' || order.order_status === 'active') &&
                !order.stock_id

              return (
                <article className="mobile-card" key={order.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">
                        {shortOrderCode(order.id)} · {getBuyerName(order)}
                      </div>
                      <div className="mobile-card-sub">{getBuyerEmail(order)}</div>
                    </div>
                    <span className={`status-badge ${currentStatus.className}`}>{currentStatus.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Produk</span>
                    <span className="mobile-card-value">
                      {product.icon} {product.name}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Paket</span>
                    <span className="mobile-card-value">{accountPackage(order, accountTypeLookup)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tanggal</span>
                    <span className="mobile-card-value">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Total</span>
                    <span className="mobile-card-value">{formatRupiah(order.total_price || 0)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Payment</span>
                    <span className="mobile-card-value">{paymentStatusLabel(order.payment_status)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Order</span>
                    <span className="mobile-card-value">{orderStatusLabel(order.order_status)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => setSelectedOrder(order)}>
                      Detail
                    </button>

                    {canConfirm && (
                      <button
                        className="action-btn orange"
                        disabled={isRunning}
                        onClick={() => runOrderAction(order, 'confirm')}
                      >
                        {isRunning ? 'Proses...' : 'Konfirmasi'}
                      </button>
                    )}

                    {!canConfirm && canSendAccount && (
                      <button
                        className="action-btn orange"
                        disabled={isRunning}
                        onClick={() => runOrderAction(order, 'send')}
                      >
                        {isRunning ? 'Proses...' : 'Kirim Akun'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="mobile-card" style={{ marginTop: 10 }}>
          <div className="mobile-card-row">
            <span className="mobile-card-label">Total order</span>
            <span className="mobile-card-value">{total}</span>
          </div>
          <div className="mobile-card-row">
            <span className="mobile-card-label">Halaman</span>
            <span className="mobile-card-value">
              {page} / {totalPages}
            </span>
          </div>

          <div className="mobile-card-actions" style={{ marginTop: 8 }}>
            <button
              className="action-btn"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading || syncing}
            >
              Prev
            </button>
            <button
              className="action-btn"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading || syncing}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div style={MODAL_OVERLAY_STYLE} onClick={() => setSelectedOrder(null)}>
          <div className="card" style={MODAL_CARD_STYLE} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Detail Order {shortOrderCode(selectedOrder.id)}</h2>
              <button className="action-btn" onClick={() => setSelectedOrder(null)}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Pembeli</span>
                <span className="mobile-card-value">{getBuyerName(selectedOrder)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Email</span>
                <span className="mobile-card-value">{getBuyerEmail(selectedOrder)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Produk</span>
                <span className="mobile-card-value">
                  {resolveProduct(selectedOrder).icon} {resolveProduct(selectedOrder).name}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Paket</span>
                <span className="mobile-card-value">{accountPackage(selectedOrder, accountTypeLookup)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Total</span>
                <span className="mobile-card-value">{formatRupiah(selectedOrder.total_price || 0)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Payment</span>
                <span className="mobile-card-value">{paymentStatusLabel(selectedOrder.payment_status)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Order State</span>
                <span className="mobile-card-value">{orderStatusLabel(selectedOrder.order_status)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Dibuat</span>
                <span className="mobile-card-value">{formatDate(selectedOrder.created_at)}</span>
              </div>

              {selectedOrder.stock && (
                <>
                  <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                  <div style={{ fontSize: 12, fontWeight: 700 }}>Akun Terkait</div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Email Akun</span>
                    <span className="mobile-card-value">{selectedOrder.stock.email}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Profile</span>
                    <span className="mobile-card-value">{selectedOrder.stock.profile_name || '-'}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Expired</span>
                    <span className="mobile-card-value">{formatDate(selectedOrder.stock.expires_at)}</span>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="topbar-btn" onClick={() => setSelectedOrder(null)}>
                  Tutup
                </button>

                {selectedOrder.payment_status === 'pending' && selectedOrder.order_status === 'pending' && (
                  <button
                    className="topbar-btn primary"
                    disabled={actionOrderID === selectedOrder.id}
                    onClick={() => runOrderAction(selectedOrder, 'confirm')}
                  >
                    {actionOrderID === selectedOrder.id ? 'Memproses...' : 'Konfirmasi'}
                  </button>
                )}

                {(selectedOrder.payment_status === 'paid' || selectedOrder.order_status === 'active') &&
                  !selectedOrder.stock_id && (
                    <button
                      className="topbar-btn primary"
                      disabled={actionOrderID === selectedOrder.id}
                      onClick={() => runOrderAction(selectedOrder, 'send')}
                    >
                      {actionOrderID === selectedOrder.id ? 'Memproses...' : 'Kirim Akun'}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
