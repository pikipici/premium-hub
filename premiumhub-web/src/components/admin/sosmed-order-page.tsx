"use client"

import { ListPagination } from '@/components/shared/list-pagination'
import { ADMIN_PAGE_LIMIT, BATCH_ACTION_LIMIT } from '@/config/pagination'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { AdminDialog, AdminPageHeader, AdminStatCard, AdminStatusPill, Button } from '@/components/admin/admin-ui'
import {
  buildMissingProviderOrderIdRecoveryPayload,
  canRetrySosmedProvider,
  getMissingProviderOrderIdNotice,
  isMissingProviderOrderIdRecoveryCandidate,
} from '@/lib/adminSosmedOrderRecovery'
import { canAdminTriggerRefill, formatProviderStatus, getAdminRefillStatusLabel, isJAPRefillCooldown } from '@/lib/sosmedRefillUi'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { sosmedOrderService, type AdminSosmedOpsSummary } from '@/services/sosmedOrderService'
import type { SosmedOrder, SosmedOrderDetail } from '@/types/sosmedOrder'


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
      return { label: 'Menunggu Bayar', tone: 'amber' as const }
    case 'processing':
      return { label: 'Diproses', tone: 'neutral' as const }
    case 'success':
      return { label: 'Sukses', tone: 'green' as const }
    case 'failed':
      return { label: 'Gagal', tone: 'red' as const }
    case 'canceled':
      return { label: 'Dibatalkan', tone: 'red' as const }
    case 'expired':
      return { label: 'Expired', tone: 'red' as const }
    default:
      return { label: value || '-', tone: 'amber' as const }
  }
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
  return canRetrySosmedProvider(order)
}

function canTriggerRefill(order: SosmedOrder) {
  return canAdminTriggerRefill(order)
}

export default function SosmedOrderPage() {
  const [items, setItems] = useState<SosmedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState<SosmedOrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [opsSummary, setOpsSummary] = useState<AdminSosmedOpsSummary | null>(null)

  const [statusDialog, setStatusDialog] = useState<{ order: SosmedOrder; toStatus: string } | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [recoveryDialog, setRecoveryDialog] = useState<SosmedOrder | null>(null)
  const [retryDialog, setRetryDialog] = useState<SosmedOrder | null>(null)
  const [retryReason, setRetryReason] = useState('')
  const [refillDialog, setRefillDialog] = useState<SosmedOrder | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / ADMIN_PAGE_LIMIT)), [total])
  const opsRiskCount = opsSummary
    ? opsSummary.retryable +
      opsSummary.missing_provider_order_id +
      opsSummary.stale_sync +
      opsSummary.provider_errors +
      opsSummary.stuck_over_24h
    : 0

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [listResult, summaryResult] = await Promise.allSettled([
        sosmedOrderService.adminList({
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit: ADMIN_PAGE_LIMIT,
        }),
        sosmedOrderService.adminOpsSummary({ stale_minutes: 30 }),
      ])

      if (listResult.status === 'rejected') {
        throw listResult.reason
      }

      if (!listResult.value.success) {
        setError(listResult.value.message || 'Gagal memuat order sosmed')
        return
      }

      setItems(listResult.value.data || [])
      setTotal(listResult.value.meta?.total ?? (listResult.value.data || []).length)

      if (summaryResult.status === 'fulfilled' && summaryResult.value.success) {
        setOpsSummary(summaryResult.value.data || null)
      } else {
        setOpsSummary(null)
      }
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
    setStatusDialog({ order, toStatus })
    setStatusReason('')
  }

  const confirmUpdateStatus = async () => {
    const dialog = statusDialog
    if (!dialog) return
    setStatusDialog(null)
    setSaving(true)
    setError('')
    try {
      const res = await sosmedOrderService.adminUpdateStatus(dialog.order.id, {
        to_status: dialog.toStatus,
        reason: statusReason,
      })
      if (!res.success) {
        setError(res.message || 'Gagal update status order sosmed')
        return
      }
      setNotice(`Status order ${dialog.order.id} diubah ke ${dialog.toStatus}`)
      await loadData()
    } catch {
      setError('Gagal update status order sosmed')
    } finally {
      setSaving(false)
    }
  }

  const prepareMissingProviderRecovery = async (order: SosmedOrder) => {
    setRecoveryDialog(order)
  }

  const confirmRecovery = async () => {
    const order = recoveryDialog
    if (!order) return
    setRecoveryDialog(null)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminUpdateStatus(order.id, buildMissingProviderOrderIdRecoveryPayload())
      if (!res.success) {
        setError(res.message || 'Gagal menyiapkan recovery provider kosong')
        return
      }

      setNotice(`Order ${order.id.slice(0, 8)} siap diretry manual setelah cek supplier`)
      if (detail?.order.id === order.id && res.data) {
        setDetail(res.data)
      }
      await loadData()
    } catch {
      setError('Gagal menyiapkan recovery provider kosong')
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
      const res = await sosmedOrderService.adminSyncProcessingProviders({ limit: BATCH_ACTION_LIMIT })
      if (!res.success || !res.data) {
        setError(res.message || 'Gagal sync massal provider')
        return
      }

      const failedPreview = (res.data.items || [])
        .filter((item) => item.result === 'failed')
        .slice(0, 3)
        .map((item) => `${String(item.order_id).slice(0, 8)}: ${item.message || item.code || 'gagal'}`)
        .join('; ')
      const limitedText = res.data.limited ? ` Batch dibatasi ${res.data.limit} order; jalankan lagi kalau masih ada antrean.` : ''
      const failedText = failedPreview ? ` Gagal awal: ${failedPreview}` : ''
      setNotice(
        `Sync provider selesai: ${res.data.synced} sukses, ${res.data.updated} update status, ${res.data.failed} gagal, ${res.data.skipped} tetap.${limitedText}${failedText}`
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
    setRetryDialog(order)
    setRetryReason(order.provider_error || '')
  }

  const confirmRetryProvider = async () => {
    const order = retryDialog
    if (!order) return
    setRetryDialog(null)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminRetryProvider(order.id, { reason: retryReason })
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

  const triggerRefill = async (order: SosmedOrder) => {
    setRefillDialog(order)
  }

  const confirmRefill = async () => {
    const order = refillDialog
    if (!order) return
    setRefillDialog(null)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedOrderService.adminTriggerRefill(order.id)
      if (!res.success) {
        setError(res.message || 'Gagal trigger refill')
        return
      }

      setNotice(`Refill order ${order.id.slice(0, 8)} berhasil dikirim ke supplier`)
      if (detail?.order.id === order.id && res.data) {
        setDetail(res.data)
      }
      await loadData()
    } catch {
      setError('Gagal trigger refill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 grid gap-4">
      <AdminPageHeader
        eyebrow="Admin Sosmed"
        title="Order DigiSosmed"
        description="Kelola status order layanan sosmed dari pending sampai selesai."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => void syncAllProviders()} disabled={loading || saving}>Sync Semua Provider</Button>
            <Button variant="outline" onClick={() => void loadData()} disabled={loading || saving}>Refresh</Button>
          </div>
        }
      />

{opsSummary ? (
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4 lg:grid-cols-5 mb-4">
        <AdminStatCard label="Total Order" value={opsSummary.total} tone="neutral" />
        <AdminStatCard label="Diproses" value={opsSummary.processing} tone="neutral" />
        <AdminStatCard label="Perlu Sync" value={opsSummary.stale_sync} tone="amber" />
        <AdminStatCard label="Retryable" value={opsSummary.retryable} tone="amber" />
        <AdminStatCard label="Provider Kosong" value={opsSummary.missing_provider_order_id} tone="red" />
        <AdminStatCard label="Provider Error" value={opsSummary.provider_errors} tone="red" />
        <AdminStatCard label="Stuck 24 Jam" value={opsSummary.stuck_over_24h} tone="red" />
      </div>
    ) : null}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2>Order DigiSosmed</h2>
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

        {opsSummary ? (
          <div style={{ padding: '0 18px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {[
                { label: 'Total Order', value: opsSummary.total, hint: 'Semua order sosmed' },
                { label: 'Diproses', value: opsSummary.processing, hint: 'Masih berjalan' },
                { label: 'Perlu Sync', value: opsSummary.stale_sync, hint: `Belum sync ${opsSummary.stale_sync_minutes} menit` },
                { label: 'Retryable', value: opsSummary.retryable, hint: 'Gagal tanpa provider ID' },
                { label: 'Provider Kosong', value: opsSummary.missing_provider_order_id, hint: 'Paid tapi belum submit' },
                { label: 'Provider Error', value: opsSummary.provider_errors, hint: 'Ada pesan error' },
                { label: 'Stuck > 24 Jam', value: opsSummary.stuck_over_24h, hint: 'Paid belum terminal' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {item.label}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800 }}>{item.value}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>{item.hint}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: opsRiskCount > 0 ? '1px solid #fed7aa' : '1px solid #bbf7d0',
                background: opsRiskCount > 0 ? '#fff7ed' : '#f0fdf4',
                color: opsRiskCount > 0 ? '#9a3412' : '#166534',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {opsRiskCount > 0
                ? `${opsRiskCount} sinyal perlu dicek: sync provider, provider gagal, order stuck >24 jam, atau submit JAP yang belum punya provider order id.`
                : 'Operasional sosmed aman: belum ada sinyal order nyangkut dari ringkasan saat ini.'}
            </div>
          </div>
        ) : null}

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
                        <td><AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill></td>
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
                            {order.provider_last_sync_result ? ` (${order.provider_last_sync_result})` : ''}
                          </div>
                          {order.refill_eligible ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: getAdminRefillStatusLabel(order).color, fontWeight: 600 }}>
                              Refill: {getAdminRefillStatusLabel(order).text}
                            </div>
                          ) : null}
                          {isMissingProviderOrderIdRecoveryCandidate(order) ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#9a3412', fontWeight: 700 }}>
                              Cek JAP dulu, lalu siapkan retry manual
                            </div>
                          ) : null}
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
                            {isMissingProviderOrderIdRecoveryCandidate(order) ? (
                              <button
                                className="action-btn"
                                type="button"
                                disabled={saving}
                                onClick={() => void prepareMissingProviderRecovery(order)}
                              >
                                Siapkan Retry Aman
                              </button>
                            ) : null}
                            {canTriggerRefill(order) ? (
                              <button
                                className="action-btn"
                                type="button"
                                disabled={saving}
                                onClick={() => void triggerRefill(order)}
                              >
                                {isJAPRefillCooldown(order) ? 'Retry Refill Cooldown' : 'Trigger Refill'}
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
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="order"
            loading={loading}
            onPageChange={setPage}
            tone="admin"
          />
        ) : null}
      </div>

      <AdminDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null) }}
        title="Detail Order DigiSosmed"
        description={detail?.order.id}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {detail?.order.provider_code === 'jap' && detail?.order.provider_order_id ? (
              <button className="action-btn" type="button" disabled={saving} onClick={() => void syncProvider(detail!.order)}>
                Sync Provider
              </button>
            ) : null}
            {detail && isMissingProviderOrderIdRecoveryCandidate(detail.order) ? (
              <button className="action-btn" type="button" disabled={saving} onClick={() => void prepareMissingProviderRecovery(detail.order)}>
                Siapkan Retry Aman
              </button>
            ) : null}
            {detail && canRetryProvider(detail.order) ? (
              <button className="action-btn" type="button" disabled={saving} onClick={() => void retryProvider(detail.order)}>
                Retry Provider
              </button>
            ) : null}
            <button className="action-btn" type="button" onClick={() => setDetail(null)}>Tutup</button>
          </div>
        }
      >
        {detail && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Layanan</div>
              <div style={{ fontWeight: 700 }}>{detail.order.service_title}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.order.service_code}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Status</div>
              <div><AdminStatusPill tone={statusLabel(detail.order.order_status).tone}>{statusLabel(detail.order.order_status).label}</AdminStatusPill></div>
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

          {detail.order.refill_eligible ? (
            <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border)', background: '#faf5ff' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Garansi Refill</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Status</div>
                  <div style={{ fontWeight: 700, color: getAdminRefillStatusLabel(detail.order).color }}>
                    {getAdminRefillStatusLabel(detail.order).text}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Periode</div>
                  <div style={{ fontWeight: 600 }}>{detail.order.refill_period_days || '-'} Hari</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Deadline</div>
                  <div style={{ fontWeight: 600 }}>{detail.order.refill_deadline ? formatDate(detail.order.refill_deadline) : '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Diklaim</div>
                  <div style={{ fontWeight: 600 }}>{detail.order.refill_requested_at ? formatDate(detail.order.refill_requested_at) : '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Refill ID JAP</div>
                  <div style={{ fontWeight: 600 }}>{detail.order.refill_provider_order_id || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Status JAP</div>
                  <div style={{ fontWeight: 600 }}>{formatProviderStatus(detail.order.refill_provider_status)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Selesai</div>
                  <div style={{ fontWeight: 600 }}>{detail.order.refill_completed_at ? formatDate(detail.order.refill_completed_at) : '-'}</div>
                </div>
              </div>
              {isJAPRefillCooldown(detail.order) ? (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
                  JAP lagi minta jeda/cooldown. Tombol retry admin tersedia karena belum ada Refill ID JAP; jalankan ulang setelah waktu tunggu supplier lewat.
                </div>
              ) : null}
              {detail.order.refill_provider_error ? (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: '#FFF1F2', color: 'var(--red)', fontSize: 12 }}>
                  {detail.order.refill_provider_error}
                </div>
              ) : null}
              {canTriggerRefill(detail.order) ? (
                <div style={{ marginTop: 10 }}>
                  <button className="action-btn" type="button" disabled={saving} onClick={() => void triggerRefill(detail.order)}>
                    {isJAPRefillCooldown(detail.order) ? 'Retry Refill Cooldown' : 'Trigger Refill'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {isMissingProviderOrderIdRecoveryCandidate(detail.order) ? (
            <div style={{ padding: 12, borderRadius: 8, background: '#fff7ed', color: '#9a3412', fontSize: 13, fontWeight: 700 }}>
              {getMissingProviderOrderIdNotice(detail.order)}
            </div>
          ) : null}

          {detail.order.provider_error ? (
            <div style={{ padding: 12, borderRadius: 8, background: '#FFF1F2', color: 'var(--red)', fontSize: 13 }}>
              {detail.order.provider_error}
            </div>
          ) : null}

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
        )}
      </AdminDialog>

      <AdminDialog
        open={!!statusDialog}
        onOpenChange={(open) => { if (!open) setStatusDialog(null) }}
        title={statusDialog ? `Ubah Status ke ${statusDialog.toStatus}` : ''}
        footer={
          <div className="flex justify-end gap-3">
            <button className="topbar-btn" onClick={() => setStatusDialog(null)} disabled={saving}>Batal</button>
            <button className="topbar-btn primary" onClick={confirmUpdateStatus} disabled={saving}>{saving ? 'Menyimpan...' : 'Ubah Status'}</button>
          </div>
        }
      >
        <label className="block text-sm font-medium mb-2">Alasan</label>
        <textarea className="w-full rounded-xl border border-neutral-200 p-3 text-sm" rows={3} value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Masukkan alasan..." />
      </AdminDialog>

      <ConfirmDialog
        open={!!recoveryDialog}
        title="Recovery Provider"
        description={recoveryDialog ? `${getMissingProviderOrderIdNotice(recoveryDialog)}\n\nLanjut tandai gagal agar tombol Retry Provider muncul?` : ''}
        confirmLabel="Tandai Gagal"
        destructive
        loading={saving}
        onConfirm={confirmRecovery}
        onCancel={() => setRecoveryDialog(null)}
      />

      <AdminDialog
        open={!!retryDialog}
        onOpenChange={(open) => { if (!open) setRetryDialog(null) }}
        title={retryDialog ? `Retry Provider — ${retryDialog.id.slice(0, 8)}` : ''}
        footer={
          <div className="flex justify-end gap-3">
            <button className="topbar-btn" onClick={() => setRetryDialog(null)} disabled={saving}>Batal</button>
            <button className="topbar-btn primary" onClick={confirmRetryProvider} disabled={saving}>{saving ? 'Mengirim...' : 'Retry Provider'}</button>
          </div>
        }
      >
        <label className="block text-sm font-medium mb-2">Alasan retry</label>
        <textarea className="w-full rounded-xl border border-neutral-200 p-3 text-sm" rows={3} value={retryReason} onChange={(e) => setRetryReason(e.target.value)} placeholder="Masukkan alasan retry..." />
      </AdminDialog>

      <ConfirmDialog
        open={!!refillDialog}
        title="Trigger Refill"
        description={refillDialog ? `Trigger refill untuk order ${refillDialog.id.slice(0, 8)}?` : ''}
        confirmLabel="Trigger Refill"
        loading={saving}
        onConfirm={confirmRefill}
        onCancel={() => setRefillDialog(null)}
      />
    </div>
  )
}
