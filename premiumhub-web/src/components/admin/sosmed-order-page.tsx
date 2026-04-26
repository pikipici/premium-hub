"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { sosmedOrderService } from '@/services/sosmedOrderService'
import type { SosmedOrder, SosmedOrderDetail } from '@/types/sosmedOrder'

const PAGE_LIMIT = 20

type StatusFilter = 'all' | 'pending_payment' | 'processing' | 'success' | 'failed' | 'canceled' | 'expired'

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'pending_payment', label: 'Menunggu Bayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'success', label: 'Sukses' },
  { key: 'failed', label: 'Gagal' },
  { key: 'canceled', label: 'Dibatalkan' },
  { key: 'expired', label: 'Expired' },
]

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusLabel(value: string) {
  switch (value) {
    case 'pending_payment':
      return { label: 'Menunggu Bayar', className: 's-tunggu' }
    case 'processing':
      return { label: 'Diproses', className: 's-proses' }
    case 'success':
      return { label: 'Sukses', className: 's-lunas' }
    case 'failed':
      return { label: 'Gagal', className: 's-gagal' }
    case 'canceled':
      return { label: 'Dibatalkan', className: 's-gagal' }
    case 'expired':
      return { label: 'Expired', className: 's-gagal' }
    default:
      return { label: value || '-', className: 's-tunggu' }
  }
}

function formatProviderStatus(value?: string) {
  const normalized = value?.trim()
  if (!normalized) return '-'
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function nextStatusActions(order: SosmedOrder) {
  if (order.order_status === 'pending_payment') {
    return [
      { status: 'processing', label: 'Set Processing' },
      { status: 'failed', label: 'Set Failed' },
      { status: 'canceled', label: 'Set Canceled' },
    ]
  }
  if (order.order_status === 'processing') {
    return [
      { status: 'success', label: 'Set Success' },
      { status: 'failed', label: 'Set Failed' },
      { status: 'canceled', label: 'Set Canceled' },
    ]
  }
  return []
}

function canRetryProvider(order: SosmedOrder) {
  return (
    order.order_status === 'failed' &&
    order.payment_method === 'wallet' &&
    order.provider_code === 'jap' &&
    !order.provider_order_id
  )
}

export default function SosmedOrderPage() {
  const [items, setItems] = useState<SosmedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState<SosmedOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminList({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        limit: PAGE_LIMIT,
      })

      if (!res.success) {
        setError(res.message || 'Gagal memuat order sosmed')
        return
      }

      setItems(res.data || [])
      setTotal(res.meta?.total ?? (res.data || []).length)
    } catch {
      setError('Gagal memuat order sosmed')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const updateStatus = async (order: SosmedOrder, toStatus: string) => {
    if (!toStatus) return

    const reason = window.prompt(`Alasan ubah status ke ${toStatus}`, '') || ''

    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminUpdateStatus(order.id, {
        to_status: toStatus,
        reason,
      })
      if (!res.success) {
        setError(res.message || 'Gagal update status order sosmed')
        return
      }

      setNotice(`Status order ${order.id} diubah ke ${toStatus}`)
      await loadData()
    } catch {
      setError('Gagal update status order sosmed')
    } finally {
      setSaving(false)
    }
  }

  const syncProvider = async (order: SosmedOrder) => {
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminSyncProvider(order.id)
      if (!res.success) {
        setError(res.message || 'Gagal sync provider order sosmed')
        return
      }

      setNotice(`Provider order ${order.id.slice(0, 8)} berhasil disinkronkan`)
      await loadData()
    } catch {
      setError('Gagal sync provider order sosmed')
    } finally {
      setSaving(false)
    }
  }

  const syncAllProviders = async () => {
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminSyncProcessingProviders({ limit: PAGE_LIMIT })
      if (!res.success || !res.data) {
        setError(res.message || 'Gagal sync massal provider')
        return
      }

      setNotice(
        `Sync provider selesai: ${res.data.synced} sukses, ${res.data.updated} update status, ${res.data.failed} gagal, ${res.data.skipped} tetap`
      )
      await loadData()
    } catch {
      setError('Gagal sync massal provider')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (order: SosmedOrder) => {
    setDetailLoading(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminGetByID(order.id)
      if (!res.success || !res.data) {
        setError(res.message || 'Gagal memuat detail order sosmed')
        return
      }
      setDetail(res.data)
    } catch {
      setError('Gagal memuat detail order sosmed')
    } finally {
      setDetailLoading(false)
    }
  }

  const retryProvider = async (order: SosmedOrder) => {
    const reason = window.prompt('Alasan retry provider', order.provider_error || '') || ''
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminRetryProvider(order.id, { reason })
      if (!res.success) {
        setError(res.message || 'Gagal retry provider order sosmed')
        return
      }

      setNotice(`Retry provider order ${order.id.slice(0, 8)} berhasil dikirim`)
      if (detail?.order.id === order.id && res.data) {
        setDetail(res.data)
      }
      await loadData()
    } catch {
      setError('Gagal retry provider order sosmed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2>Order Sosmed</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Kelola status order layanan sosmed dari pending sampai selesai.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="action-btn" type="button" disabled={loading || saving} onClick={() => void syncAllProviders()}>
              Sync Semua Provider
            </button>
            <button className="action-btn" type="button" disabled={loading || saving} onClick={() => void loadData()}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="action-btn"
              style={
                statusFilter === filter.key
                  ? { background: '#141414', borderColor: '#141414', color: '#fff' }
                  : undefined
              }
              onClick={() => {
                setStatusFilter(filter.key)
                setPage(1)
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {(error || notice) && (
          <div style={{ padding: '0 18px 12px' }}>
            {error && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
            {notice && <div className="alert success">{notice}</div>}
          </div>
        )}

        <div style={{ padding: '0 18px 18px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat order sosmed...</div>
          ) : items.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada order sosmed.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Layanan</th>
                    <th>Target</th>
                    <th>Total</th>
                    <th>Pembayaran</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Dibuat</th>
                    <th style={{ width: 280 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => {
                    const status = statusLabel(order.order_status)
                    const actions = nextStatusActions(order)

                    return (
                      <tr key={order.id}>
                        <td><code>{order.id.slice(0, 8)}...</code></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{order.service_title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{order.service_code}</div>
                        </td>
                        <td style={{ maxWidth: 220, wordBreak: 'break-all' }}>{order.target_link || '-'}</td>
                        <td>{formatRupiah(order.total_price)}</td>
                        <td>
                          <div style={{ textTransform: 'uppercase', fontWeight: 600 }}>{order.payment_status}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{order.payment_method || '-'}</div>
                        </td>
                        <td><span className={`status ${status.className}`}>{status.label}</span></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{(order.provider_code || '-').toUpperCase()}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {order.provider_order_id ? `Order ${order.provider_order_id}` : 'Belum ada provider order id'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Status: {formatProviderStatus(order.provider_status)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Sync: {order.provider_synced_at ? formatDate(order.provider_synced_at) : '-'}
                          </div>
                          {order.provider_error ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--red)' }}>
                              {order.provider_error}
                            </div>
                          ) : null}
                        </td>
                        <td>{formatDate(order.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="action-btn"
                              type="button"
                              disabled={saving || detailLoading}
                              onClick={() => void openDetail(order)}
                            >
                              Detail
                            </button>
                            {order.provider_code === 'jap' && order.provider_order_id ? (
                              <button
                                className="action-btn"
                                type="button"
                                disabled={saving}
                                onClick={() => void syncProvider(order)}
                              >
                                Sync Provider
                              </button>
                            ) : null}
                            {canRetryProvider(order) ? (
                              <button
                                className="action-btn"
                                type="button"
                                disabled={saving}
                                onClick={() => void retryProvider(order)}
                              >
                                Retry Provider
                              </button>
                            ) : null}
                            {actions.length === 0 ? null : (
                              actions.map((action) => (
                                <button
                                  key={`${order.id}-${action.status}`}
                                  className="action-btn"
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void updateStatus(order, action.status)}
                                >
                                  {action.label}
                                </button>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && total > 0 ? (
          <div style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Menampilkan {items.length} dari total {total}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="action-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page} / {totalPages}</span>
              <button
                type="button"
                className="action-btn"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {detail ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(10,10,10,0.42)',
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '88vh',
              overflow: 'auto',
              borderRadius: 8,
              background: '#fff',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: 18, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Detail Order Sosmed</h3>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{detail.order.id}</div>
              </div>
              <button className="action-btn" type="button" onClick={() => setDetail(null)}>Tutup</button>
            </div>

            <div style={{ padding: 18, display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Layanan</div>
                  <div style={{ fontWeight: 700 }}>{detail.order.service_title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.order.service_code}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Status</div>
                  <div><span className={`status ${statusLabel(detail.order.order_status).className}`}>{statusLabel(detail.order.order_status).label}</span></div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{detail.order.payment_status} via {detail.order.payment_method || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Provider</div>
                  <div style={{ fontWeight: 700 }}>{(detail.order.provider_code || '-').toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.order.provider_order_id || 'Belum ada provider order id'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Total</div>
                  <div style={{ fontWeight: 700 }}>{formatRupiah(detail.order.total_price)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.order.quantity} paket x {formatRupiah(detail.order.unit_price)}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Target</div>
                <div style={{ wordBreak: 'break-all' }}>{detail.order.target_link || '-'}</div>
              </div>

              {detail.order.provider_error ? (
                <div style={{ padding: 12, borderRadius: 8, background: '#FFF1F2', color: 'var(--red)', fontSize: 13 }}>
                  {detail.order.provider_error}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.order.provider_code === 'jap' && detail.order.provider_order_id ? (
                  <button className="action-btn" type="button" disabled={saving} onClick={() => void syncProvider(detail.order)}>
                    Sync Provider
                  </button>
                ) : null}
                {canRetryProvider(detail.order) ? (
                  <button className="action-btn" type="button" disabled={saving} onClick={() => void retryProvider(detail.order)}>
                    Retry Provider
                  </button>
                ) : null}
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px' }}>Timeline</h4>
                <div style={{ display: 'grid', gap: 8 }}>
                  {detail.events.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada event.</div>
                  ) : (
                    detail.events.map((event) => (
                      <div key={event.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 700 }}>{event.from_status || '-'} → {event.to_status || '-'}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(event.created_at)}</div>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{event.reason || '-'}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>Actor: {event.actor_type}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
