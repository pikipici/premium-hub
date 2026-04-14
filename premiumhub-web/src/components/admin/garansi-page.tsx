"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { accountTypeService } from '@/services/accountTypeService'
import { claimService, type AdminClaimStatus } from '@/services/claimService'
import { orderService } from '@/services/orderService'
import { productService } from '@/services/productService'
import type { AccountType } from '@/types/accountType'
import type { Claim, Order } from '@/types/order'

type ClaimFilter = 'all' | AdminClaimStatus

type ProductLookup = Record<string, { name: string; icon: string }>
type OrderLookup = Record<string, Order>

const PAGE_LIMIT = 20

const STATUS_FILTERS: { value: ClaimFilter; label: string }[] = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const REASON_LABELS: Record<string, string> = {
  login: 'Tidak Bisa Login',
  password: 'Password Salah',
  kicked: 'Akun Dikeluarkan',
  profile: 'Masalah Profil',
  quality: 'Kualitas Buruk',
  other: 'Lainnya',
}

const FALLBACK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  shared: 'Shared · Akun Bersama',
  private: 'Private · Akun Pribadi',
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
  maxWidth: 620,
  maxHeight: '90vh',
  overflow: 'auto' as const,
  borderRadius: 16,
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
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

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return '-'
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortCode(id?: string | null) {
  if (!id) return '-'
  return `#${id.split('-')[0]?.toUpperCase() || id}`
}

function reasonLabel(reason?: string | null) {
  const normalized = (reason || '').toLowerCase()
  if (!normalized) return '-'
  return REASON_LABELS[normalized] || normalized
}

function statusMeta(status?: string | null) {
  if (status === 'approved') return { label: 'Disetujui', className: 's-lunas' }
  if (status === 'rejected') return { label: 'Ditolak', className: 's-gagal' }
  return { label: 'Pending', className: 's-pending' }
}

function truncateText(value: string, max = 90) {
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

function claimPackage(claim: Claim, order?: Order, accountTypeLookup?: Record<string, AccountType>) {
  const duration = order?.price?.duration
  const accountType = formatAccountTypeLabel(order?.price?.account_type, accountTypeLookup)

  if (!duration && accountType === '-') return '-'
  if (!duration) return accountType
  if (accountType === '-') return `${duration} Bulan`

  return `${duration} Bulan · ${accountType}`
}

export default function GaransiPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [ordersByID, setOrdersByID] = useState<OrderLookup>({})
  const [productsByID, setProductsByID] = useState<ProductLookup>({})
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [actionLoadingID, setActionLoadingID] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClaimFilter>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [actionModal, setActionModal] = useState<{ claim: Claim; action: 'approve' | 'reject' } | null>(null)
  const [adminNote, setAdminNote] = useState('')

  const accountTypeLookup = useMemo(() => {
    return accountTypes.reduce<Record<string, AccountType>>((acc, item) => {
      const code = normalizeAccountTypeCode(item.code)
      if (!code) return acc
      acc[code] = item
      return acc
    }, {})
  }, [accountTypes])

  const resolveOrder = useCallback(
    (claim: Claim) => {
      return ordersByID[claim.order_id] || claim.order || undefined
    },
    [ordersByID]
  )

  const resolveProduct = useCallback(
    (claim: Claim) => {
      const order = resolveOrder(claim)
      const productID = order?.price?.product_id

      if (productID && productsByID[productID]) {
        return productsByID[productID]
      }

      return {
        icon: '📦',
        name: productID ? `Produk ${productID.slice(0, 8)}` : `Order ${shortCode(claim.order_id)}`,
      }
    },
    [productsByID, resolveOrder]
  )

  const getBuyerName = useCallback((claim: Claim) => {
    if (claim.user?.name?.trim()) return claim.user.name

    const order = resolveOrder(claim)
    if (order?.user?.name?.trim()) return order.user.name

    if (claim.user_id) return `User ${claim.user_id.slice(0, 8)}`
    return 'User'
  }, [resolveOrder])

  const getBuyerEmail = useCallback((claim: Claim) => {
    if (claim.user?.email?.trim()) return claim.user.email

    const order = resolveOrder(claim)
    if (order?.user?.email?.trim()) return order.user.email

    return '-'
  }, [resolveOrder])

  const loadProductLookup = useCallback(async () => {
    try {
      const res = await productService.adminList({ page: 1, limit: 300 })
      if (!res.success) return

      const mapped = res.data.reduce<ProductLookup>((acc, product) => {
        acc[product.id] = { name: product.name, icon: product.icon || '📦' }
        return acc
      }, {})

      setProductsByID(mapped)
    } catch {
      // best effort only
    }
  }, [])

  const loadOrderLookup = useCallback(async () => {
    try {
      let currentPage = 1
      let resolvedPages = 1
      const mapped: OrderLookup = {}

      while (currentPage <= resolvedPages && currentPage <= 6) {
        const res = await orderService.adminList({ page: currentPage, limit: 100 })
        if (!res.success) break

        res.data.forEach((order) => {
          mapped[order.id] = order
        })

        resolvedPages = res.meta?.total_pages ?? 1
        currentPage += 1
      }

      setOrdersByID(mapped)
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
      // best effort only
    }
  }, [])

  const loadClaims = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await claimService.adminList({
          page,
          limit: PAGE_LIMIT,
          status: statusFilter === 'all' ? undefined : statusFilter,
        })

        if (!res.success) {
          setError(res.message || 'Gagal memuat klaim garansi')
          return
        }

        setClaims(res.data)

        const totalData = res.meta?.total ?? res.data.length
        const resolvedTotalPages = Math.max(1, res.meta?.total_pages ?? 1)

        setTotal(totalData)
        setTotalPages(resolvedTotalPages)

        if (page > resolvedTotalPages) {
          setPage(resolvedTotalPages)
        }
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat klaim garansi admin'))
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    [page, statusFilter]
  )

  useEffect(() => {
    void Promise.all([loadClaims(), loadProductLookup(), loadOrderLookup(), loadAccountTypes()])
  }, [loadAccountTypes, loadClaims, loadOrderLookup, loadProductLookup])

  useEffect(() => {
    if (!selectedClaim && !actionModal) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (actionModal) {
          setActionModal(null)
          return
        }

        setSelectedClaim(null)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [actionModal, selectedClaim])

  const filteredClaims = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return claims

    return claims.filter((claim) => {
      const order = resolveOrder(claim)
      const product = resolveProduct(claim)
      const packageLabel = claimPackage(claim, order, accountTypeLookup)

      const haystack = [
        shortCode(claim.id),
        claim.id,
        shortCode(claim.order_id),
        claim.order_id,
        getBuyerName(claim),
        getBuyerEmail(claim),
        reasonLabel(claim.reason),
        claim.description,
        product.name,
        packageLabel,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [accountTypeLookup, claims, getBuyerEmail, getBuyerName, resolveOrder, resolveProduct, search])

  const pendingCount = useMemo(
    () => claims.filter((claim) => claim.status === 'pending').length,
    [claims]
  )

  const refreshClaims = async () => {
    await Promise.all([loadClaims({ silent: true }), loadOrderLookup()])
  }

  const openActionModal = (claim: Claim, action: 'approve' | 'reject') => {
    setActionModal({ claim, action })
    setAdminNote(claim.admin_note || '')
    setError('')
  }

  const closeActionModal = () => {
    if (actionLoadingID) return
    setActionModal(null)
    setAdminNote('')
  }

  const submitAction = async () => {
    if (!actionModal) return

    if (actionModal.action === 'reject' && !adminNote.trim()) {
      setError('Catatan admin wajib diisi saat menolak klaim.')
      return
    }

    const { claim, action } = actionModal

    setActionLoadingID(claim.id)
    setError('')

    try {
      const payload = adminNote.trim() ? { admin_note: adminNote.trim() } : undefined

      const res = action === 'approve'
        ? await claimService.adminApprove(claim.id, payload)
        : await claimService.adminReject(claim.id, payload)

      if (!res.success) {
        setError(res.message || 'Aksi klaim gagal dijalankan')
        return
      }

      setNotice(
        action === 'approve'
          ? `Klaim ${shortCode(claim.id)} berhasil disetujui.`
          : `Klaim ${shortCode(claim.id)} berhasil ditolak.`
      )

      setActionModal(null)
      setSelectedClaim(null)
      setAdminNote('')

      await refreshClaims()
    } catch (err) {
      setError(
        mapErrorMessage(
          err,
          action === 'approve' ? 'Gagal menyetujui klaim' : 'Gagal menolak klaim'
        )
      )
    } finally {
      setActionLoadingID(null)
    }
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
              placeholder="🔍 Cari klaim / user / produk..."
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 300,
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ClaimFilter)
                setPage(1)
              }}
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
            <button className="topbar-btn" onClick={refreshClaims} disabled={loading || syncing}>
              {syncing ? 'Menyegarkan...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Klaim Garansi</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Pending halaman ini:{' '}
              <strong style={{ color: 'var(--dark)' }}>{pendingCount}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Produk</th>
                  <th>Keluhan</th>
                  <th>Tgl Klaim</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat klaim garansi...
                    </td>
                  </tr>
                ) : filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Tidak ada klaim pada filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => {
                    const order = resolveOrder(claim)
                    const product = resolveProduct(claim)
                    const status = statusMeta(claim.status)
                    const isPending = claim.status === 'pending'
                    const isRunning = actionLoadingID === claim.id

                    return (
                      <tr key={claim.id}>
                        <td>
                          <div className="order-buyer">{getBuyerName(claim)}</div>
                          <div className="order-email">{getBuyerEmail(claim)}</div>
                        </td>

                        <td>
                          <span className="product-pill">
                            {product.icon} {product.name}
                          </span>
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                            {claimPackage(claim, order, accountTypeLookup)}
                          </div>
                        </td>

                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          <div style={{ fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                            {reasonLabel(claim.reason)}
                          </div>
                          “{truncateText(claim.description)}”
                        </td>

                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {formatDate(claim.created_at)}
                        </td>

                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => setSelectedClaim(claim)}>
                              Detail
                            </button>

                            {isPending && (
                              <button
                                className="g-approve"
                                disabled={isRunning}
                                onClick={() => openActionModal(claim, 'approve')}
                              >
                                {isRunning ? 'Proses...' : '✓ Setujui'}
                              </button>
                            )}

                            {isPending && (
                              <button
                                className="g-reject"
                                disabled={isRunning}
                                onClick={() => openActionModal(claim, 'reject')}
                              >
                                {isRunning ? 'Proses...' : '✕ Tolak'}
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
              Menampilkan <strong style={{ color: 'var(--dark)' }}>{filteredClaims.length}</strong> item · Page{' '}
              <strong style={{ color: 'var(--dark)' }}>{page}</strong> /{' '}
              <strong style={{ color: 'var(--dark)' }}>{totalPages}</strong> · Total{' '}
              <strong style={{ color: 'var(--dark)' }}>{total}</strong>
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
            <div className="mobile-page-title">Klaim Garansi</div>
            <div className="mobile-page-subtitle">Prioritaskan klaim pending</div>
          </div>
          <span className="status-badge s-pending">{pendingCount} Pending</span>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari klaim / user / produk"
            />

            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ClaimFilter)
                setPage(1)
              }}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button className="mobile-chip-btn" onClick={refreshClaims} disabled={loading || syncing}>
              {syncing ? 'Sync...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Memuat klaim garansi...</div>
            </article>
          ) : filteredClaims.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada klaim pada filter ini.</div>
            </article>
          ) : (
            filteredClaims.map((claim) => {
              const order = resolveOrder(claim)
              const product = resolveProduct(claim)
              const status = statusMeta(claim.status)
              const isPending = claim.status === 'pending'
              const isRunning = actionLoadingID === claim.id

              return (
                <article className="mobile-card" key={claim.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">{getBuyerName(claim)}</div>
                      <div className="mobile-card-sub">{getBuyerEmail(claim)}</div>
                    </div>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Produk</span>
                    <span className="mobile-card-value">
                      {product.icon} {product.name}
                    </span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Paket</span>
                    <span className="mobile-card-value">{claimPackage(claim, order, accountTypeLookup)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Keluhan</span>
                    <span className="mobile-card-value">{truncateText(claim.description, 80)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Alasan</span>
                    <span className="mobile-card-value">{reasonLabel(claim.reason)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tanggal</span>
                    <span className="mobile-card-value">{formatDate(claim.created_at)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => setSelectedClaim(claim)}>
                      Detail
                    </button>

                    {isPending && (
                      <button className="g-reject" disabled={isRunning} onClick={() => openActionModal(claim, 'reject')}>
                        {isRunning ? 'Proses...' : 'Tolak'}
                      </button>
                    )}

                    {isPending && (
                      <button className="g-approve" disabled={isRunning} onClick={() => openActionModal(claim, 'approve')}>
                        {isRunning ? 'Proses...' : 'Setujui'}
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
            <span className="mobile-card-label">Total klaim</span>
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

      {selectedClaim && (
        <div style={MODAL_OVERLAY_STYLE} onClick={() => setSelectedClaim(null)}>
          <div className="card" style={MODAL_CARD_STYLE} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Detail Klaim {shortCode(selectedClaim.id)}</h2>
              <button className="action-btn" onClick={() => setSelectedClaim(null)}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div className="mobile-card-row">
                <span className="mobile-card-label">User</span>
                <span className="mobile-card-value">{getBuyerName(selectedClaim)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Email</span>
                <span className="mobile-card-value">{getBuyerEmail(selectedClaim)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Order</span>
                <span className="mobile-card-value">{shortCode(selectedClaim.order_id)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Produk</span>
                <span className="mobile-card-value">
                  {resolveProduct(selectedClaim).icon} {resolveProduct(selectedClaim).name}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Paket</span>
                <span className="mobile-card-value">
                  {claimPackage(selectedClaim, resolveOrder(selectedClaim), accountTypeLookup)}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Alasan</span>
                <span className="mobile-card-value">{reasonLabel(selectedClaim.reason)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Keluhan</span>
                <span className="mobile-card-value" style={{ textAlign: 'left' }}>{selectedClaim.description}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Screenshot</span>
                <span className="mobile-card-value" style={{ textAlign: 'left' }}>
                  {selectedClaim.screenshot_url ? (
                    <a href={selectedClaim.screenshot_url} target="_blank" rel="noreferrer" className="link-btn">
                      Lihat bukti
                    </a>
                  ) : (
                    '-'
                  )}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className={`status-badge ${statusMeta(selectedClaim.status).className}`}>
                  {statusMeta(selectedClaim.status).label}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Admin Note</span>
                <span className="mobile-card-value" style={{ textAlign: 'left' }}>
                  {selectedClaim.admin_note?.trim() || '-'}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Diajukan</span>
                <span className="mobile-card-value">{formatDateTime(selectedClaim.created_at)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Diselesaikan</span>
                <span className="mobile-card-value">{formatDateTime(selectedClaim.resolved_at)}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
                <button className="topbar-btn" onClick={() => setSelectedClaim(null)}>
                  Tutup
                </button>

                {selectedClaim.status === 'pending' && (
                  <button className="g-reject" onClick={() => openActionModal(selectedClaim, 'reject')}>
                    ✕ Tolak
                  </button>
                )}

                {selectedClaim.status === 'pending' && (
                  <button className="g-approve" onClick={() => openActionModal(selectedClaim, 'approve')}>
                    ✓ Setujui
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {actionModal && (
        <div style={MODAL_OVERLAY_STYLE} onClick={closeActionModal}>
          <div className="card" style={{ ...MODAL_CARD_STYLE, maxWidth: 520 }} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>{actionModal.action === 'approve' ? 'Setujui Klaim' : 'Tolak Klaim'} {shortCode(actionModal.claim.id)}</h2>
              <button className="action-btn" onClick={closeActionModal} disabled={!!actionLoadingID}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {actionModal.action === 'approve'
                  ? 'Setujui klaim ini dan sistem akan assign akun pengganti otomatis jika stok tersedia.'
                  : 'Tolak klaim ini. Isi catatan admin sebagai alasan penolakan.'}
              </div>

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>
                Catatan Admin {actionModal.action === 'reject' ? '(wajib)' : '(opsional)'}
              </label>

              <textarea
                className="form-textarea"
                rows={4}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder={actionModal.action === 'approve' ? 'Contoh: valid, diproses penggantian akun' : 'Contoh: bukti kurang jelas / masa garansi habis'}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="action-btn" onClick={closeActionModal} disabled={!!actionLoadingID}>
                  Batal
                </button>
                <button
                  className="topbar-btn primary"
                  onClick={submitAction}
                  disabled={!!actionLoadingID}
                >
                  {actionLoadingID ? 'Memproses...' : actionModal.action === 'approve' ? 'Setujui Klaim' : 'Tolak Klaim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
