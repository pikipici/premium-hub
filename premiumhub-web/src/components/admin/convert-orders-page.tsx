"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertAssetType, ConvertOrderDetail, ConvertOrderStatus, ConvertOrderSummary } from '@/types/convert'

type StatusFilter = 'all' | ConvertOrderStatus

type QueueAction = {
  toStatus: ConvertOrderStatus
  label: string
}

const PAGE_SIZE = 20

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function assetLabel(asset: ConvertAssetType) {
  if (asset === 'pulsa') return 'Pulsa'
  if (asset === 'paypal') return 'PayPal'
  return 'Crypto'
}

function statusMeta(status: ConvertOrderStatus) {
  if (status === 'pending_transfer') return { label: 'Pending Transfer', className: 's-pending' }
  if (status === 'waiting_review') return { label: 'Waiting Review', className: 's-proses' }
  if (status === 'approved') return { label: 'Approved', className: 's-proses' }
  if (status === 'processing') return { label: 'Diproses', className: 's-proses' }
  if (status === 'success') return { label: 'Sukses', className: 's-lunas' }
  if (status === 'failed') return { label: 'Gagal', className: 's-gagal' }
  if (status === 'expired') return { label: 'Expired', className: 's-gagal' }
  return { label: 'Canceled', className: 's-gagal' }
}

function availableActions(status: ConvertOrderStatus): QueueAction[] {
  if (status === 'pending_transfer') {
    return [{ toStatus: 'waiting_review', label: 'Set Review' }]
  }
  if (status === 'waiting_review') {
    return [
      { toStatus: 'approved', label: 'Approve' },
      { toStatus: 'failed', label: 'Gagalkan' },
    ]
  }
  if (status === 'approved') {
    return [
      { toStatus: 'processing', label: 'Proses' },
      { toStatus: 'failed', label: 'Gagalkan' },
    ]
  }
  if (status === 'processing') {
    return [
      { toStatus: 'success', label: 'Sukseskan' },
      { toStatus: 'failed', label: 'Gagalkan' },
    ]
  }
  return []
}

function proofQuickHint(status: ConvertOrderStatus) {
  if (status === 'pending_transfer') return 'Biasanya bukti belum masuk.'
  if (status === 'waiting_review') return 'Buka bukti untuk validasi cepat.'
  if (status === 'approved' || status === 'processing') return 'Cek bukti sebelum finalisasi.'
  return 'Lihat bukti yang tersimpan.'
}

export default function ConvertOrdersPage() {
  const [orders, setOrders] = useState<ConvertOrderSummary[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assetFilter, setAssetFilter] = useState<'all' | ConvertAssetType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actingKey, setActingKey] = useState('')

  const [proofDrawerOpen, setProofDrawerOpen] = useState(false)
  const [proofDrawerLoading, setProofDrawerLoading] = useState(false)
  const [proofDrawerError, setProofDrawerError] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<ConvertOrderDetail | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [assetFilter, statusFilter, debouncedSearch])

  const loadOrders = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const res = await convertService.adminListOrders({
        page,
        limit: PAGE_SIZE,
        asset_type: assetFilter === 'all' ? undefined : assetFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: debouncedSearch || undefined,
      })

      if (!res.success) {
        setError(res.message || 'Gagal memuat queue convert')
        return
      }

      setOrders(res.data)
      setTotal(res.meta?.total ?? res.data.length)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat queue convert'))
    } finally {
      if (silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [assetFilter, debouncedSearch, page, statusFilter])

  useEffect(() => {
    void loadOrders(false)
  }, [loadOrders])

  const openProofDrawer = async (orderID: string) => {
    setProofDrawerOpen(true)
    setProofDrawerLoading(true)
    setProofDrawerError('')

    try {
      const res = await convertService.adminGetOrderByID(orderID)
      if (!res.success) {
        setProofDrawerError(res.message || 'Gagal memuat detail bukti transfer')
        return
      }
      setSelectedDetail(res.data)
    } catch (err: unknown) {
      setProofDrawerError(getHttpErrorMessage(err, 'Gagal memuat detail bukti transfer'))
    } finally {
      setProofDrawerLoading(false)
    }
  }

  const closeProofDrawer = () => {
    setProofDrawerOpen(false)
    setProofDrawerLoading(false)
    setProofDrawerError('')
    setSelectedDetail(null)
  }

  const runAction = async (order: ConvertOrderSummary, action: QueueAction) => {
    const key = `${order.id}:${action.toStatus}`
    setActingKey(key)
    setError('')

    try {
      const res = await convertService.adminUpdateOrderStatus(order.id, {
        to_status: action.toStatus,
        reason: `Admin action: ${action.label}`,
      })

      if (!res.success) {
        setError(res.message || 'Gagal update status order convert')
        return
      }

      if (selectedDetail?.order.id === order.id) {
        setSelectedDetail(res.data)
      }

      setNotice(`Order ${order.id} berhasil di-update ke status ${action.toStatus}.`)
      await loadOrders(true)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal update status order convert'))
    } finally {
      setActingKey('')
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
        <div className="alert-bar" style={{ marginBottom: 12, background: '#FEECEC', borderColor: '#F7C6C6', color: '#B42318' }}>
          ⚠️ <strong>{error}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setError('')}
          >
            tutup
          </button>
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
              placeholder="🔍 Cari order convert / user"
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
              value={assetFilter}
              onChange={(event) => setAssetFilter(event.target.value as 'all' | ConvertAssetType)}
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
              <option value="all">Semua Aset</option>
              <option value="pulsa">Pulsa</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">Crypto</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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
              <option value="all">Semua Status</option>
              <option value="pending_transfer">Pending Transfer</option>
              <option value="waiting_review">Waiting Review</option>
              <option value="approved">Approved</option>
              <option value="processing">Diproses</option>
              <option value="success">Sukses</option>
              <option value="failed">Gagal</option>
              <option value="expired">Expired</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => void loadOrders(true)}
              className="topbar-btn"
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} className="animate-spin" /> Refreshing
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCcw size={14} /> Refresh
                </span>
              )}
            </button>
            <Link href="/admin/convert" className="topbar-btn">Overview</Link>
            <Link href="/admin/convert/pricing" className="topbar-btn">Pricing</Link>
            <Link href="/admin/convert/limits" className="topbar-btn">Limits</Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Queue Order Convert</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total: <strong style={{ color: 'var(--dark)' }}>{total}</strong> order
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>User</th>
                  <th>Aset</th>
                  <th>Nominal</th>
                  <th>Tujuan</th>
                  <th>Bukti</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Loader2 size={14} className="animate-spin" /> Memuat queue convert...
                      </span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      Tidak ada order untuk filter saat ini.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const status = statusMeta(order.status)
                    const actions = availableActions(order.status)

                    return (
                      <tr key={order.id}>
                        <td>
                          <div className="order-id">{order.id}</div>
                          <div className="order-email">{formatDate(order.created_at)}</div>
                        </td>
                        <td>
                          <div className="order-buyer">{order.user_name || 'User'}</div>
                          <div className="order-email">{order.user_email || order.user_id}</div>
                        </td>
                        <td>
                          <span className="product-pill">{assetLabel(order.asset_type)}</span>
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                            {order.source_channel} · {order.source_account}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--dark)' }}>{formatRupiah(order.source_amount)}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Terima: {formatRupiah(order.receive_amount)}</div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <span style={{ fontSize: 12, color: 'var(--dark)' }}>
                            {order.destination_bank} · {order.destination_account_number}
                          </span>
                        </td>
                        <td style={{ minWidth: 170 }}>
                          <button
                            className="action-btn"
                            onClick={() => void openProofDrawer(order.id)}
                            disabled={proofDrawerLoading && selectedDetail?.order.id === order.id}
                          >
                            Lihat Bukti
                          </button>
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>{proofQuickHint(order.status)}</div>
                        </td>
                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {order.tracking_token ? (
                              <Link
                                className="action-btn"
                                href={`/product/convert/track/${encodeURIComponent(order.tracking_token)}`}
                                target="_blank"
                              >
                                Detail
                              </Link>
                            ) : (
                              <button className="action-btn" disabled>Detail</button>
                            )}

                            {actions.map((action) => {
                              const key = `${order.id}:${action.toStatus}`
                              const acting = actingKey === key
                              return (
                                <button
                                  key={key}
                                  className="action-btn orange"
                                  onClick={() => void runAction(order, action)}
                                  disabled={!!actingKey}
                                >
                                  {acting ? '...' : action.label}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && total > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} / {totalPages}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="topbar-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Prev</button>
              <button className="topbar-btn" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Queue Convert</div>
            <div className="mobile-page-subtitle">Pantau order per aset</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => void loadOrders(true)} className="mobile-chip-btn" disabled={loading || refreshing}>
              {refreshing ? '...' : 'Refresh'}
            </button>
            <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari ID / user / sumber"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <select className="form-select" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value as 'all' | ConvertAssetType)}>
                <option value="all">Semua Aset</option>
                <option value="pulsa">Pulsa</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Crypto</option>
              </select>

              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Semua Status</option>
                <option value="pending_transfer">Pending Transfer</option>
                <option value="waiting_review">Waiting Review</option>
                <option value="approved">Approved</option>
                <option value="processing">Diproses</option>
                <option value="success">Sukses</option>
                <option value="failed">Gagal</option>
                <option value="expired">Expired</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Loader2 size={14} className="animate-spin" /> Memuat queue convert...
              </div>
            </article>
          ) : orders.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada order untuk filter ini.</div>
            </article>
          ) : (
            orders.map((order) => {
              const status = statusMeta(order.status)
              const actions = availableActions(order.status)

              return (
                <article className="mobile-card" key={order.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">{order.id} · {order.user_name || 'User'}</div>
                      <div className="mobile-card-sub">{order.user_email || order.user_id}</div>
                    </div>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Aset</span>
                    <span className="mobile-card-value">{assetLabel(order.asset_type)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Sumber</span>
                    <span className="mobile-card-value">{order.source_channel} · {order.source_account}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tujuan</span>
                    <span className="mobile-card-value">{order.destination_bank} · {order.destination_account_number}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Nominal</span>
                    <span className="mobile-card-value">{formatRupiah(order.source_amount)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Terima</span>
                    <span className="mobile-card-value">{formatRupiah(order.receive_amount)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Bukti</span>
                    <button className="action-btn" onClick={() => void openProofDrawer(order.id)}>Lihat Bukti</button>
                  </div>
                  <div className="mobile-card-sub" style={{ marginTop: 4 }}>{proofQuickHint(order.status)}</div>

                  <div className="mobile-card-actions">
                    {order.tracking_token ? (
                      <Link className="action-btn" href={`/product/convert/track/${encodeURIComponent(order.tracking_token)}`} target="_blank">
                        Detail
                      </Link>
                    ) : (
                      <button className="action-btn" disabled>Detail</button>
                    )}

                    {actions.map((action) => {
                      const key = `${order.id}:${action.toStatus}`
                      const acting = actingKey === key
                      return (
                        <button
                          key={key}
                          className="action-btn orange"
                          onClick={() => void runAction(order, action)}
                          disabled={!!actingKey}
                        >
                          {acting ? '...' : action.label}
                        </button>
                      )
                    })}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      {proofDrawerOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(20, 20, 20, 0.45)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
          onClick={closeProofDrawer}
        >
          <div
            style={{
              width: 'min(860px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #EBEBEB',
              padding: 16,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#141414' }}>Detail Bukti Transfer</h3>
                <div style={{ marginTop: 4, fontSize: 12, color: '#777' }}>
                  {selectedDetail ? `Order ${selectedDetail.order.id}` : 'Memuat detail order...'}
                </div>
              </div>
              <button className="topbar-btn" onClick={closeProofDrawer}>Tutup</button>
            </div>

            {proofDrawerLoading ? (
              <div style={{ fontSize: 13, color: '#666', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" /> Memuat bukti transfer...
              </div>
            ) : proofDrawerError ? (
              <div className="alert-bar" style={{ background: '#FEECEC', borderColor: '#F7C6C6', color: '#B42318' }}>
                ⚠️ <strong>{proofDrawerError}</strong>
              </div>
            ) : selectedDetail ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: '1px solid #EBEBEB', borderRadius: 10, padding: 12, background: '#FAFAF8' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#888' }}>Status</div>
                      <div style={{ fontWeight: 700, color: '#141414' }}>{statusMeta(selectedDetail.order.status).label}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Aset</div>
                      <div style={{ fontWeight: 700, color: '#141414' }}>{assetLabel(selectedDetail.order.asset_type)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Sumber</div>
                      <div style={{ fontWeight: 700, color: '#141414' }}>{selectedDetail.order.source_channel} · {selectedDetail.order.source_account}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Tujuan</div>
                      <div style={{ fontWeight: 700, color: '#141414' }}>{selectedDetail.order.destination_bank} · {selectedDetail.order.destination_account_number}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#141414' }}>Bukti yang di-submit user</h4>
                    <span style={{ fontSize: 12, color: '#777' }}>{selectedDetail.proofs.length} bukti</span>
                  </div>

                  {selectedDetail.proofs.length === 0 ? (
                    <div style={{ border: '1px solid #F7C6C6', borderRadius: 10, background: '#FFF4F4', color: '#B42318', fontSize: 12, padding: 10 }}>
                      Belum ada bukti transfer yang diunggah user.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selectedDetail.proofs.map((proof) => (
                        <div key={proof.id} style={{ border: '1px solid #EBEBEB', borderRadius: 10, background: '#FAFAF8', padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <a
                              href={proof.file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 13, fontWeight: 700, color: '#141414', textDecoration: 'underline' }}
                            >
                              {proof.file_name || proof.file_url}
                            </a>
                            <span style={{ fontSize: 11, color: '#777' }}>{formatDate(proof.created_at)}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
                            Upload via: <strong>{proof.uploaded_by_type}</strong>
                            {proof.note ? ` · Note: ${proof.note}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
