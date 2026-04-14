"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { adminUserService, type AdminUserStatusFilter } from '@/services/adminUserService'
import type { AdminUser } from '@/types/adminUser'

type StatusFilter = 'all' | AdminUserStatusFilter

const PAGE_LIMIT = 20

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
]

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

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0)
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

function statusMeta(isActive: boolean) {
  if (isActive) return { label: 'Aktif', className: 's-lunas' }
  return { label: 'Nonaktif', className: 's-gagal' }
}

function roleLabel(role?: string | null) {
  const normalized = (role || '').trim().toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'super_admin') return 'Super Admin'
  if (!normalized) return 'User'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function shortUserCode(id?: string | null) {
  if (!id) return '-'
  return `#${id.split('-')[0]?.toUpperCase() || id}`
}

function toSafeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function parseCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

export default function PenggunaPage() {
  const [users, setUsers] = useState<AdminUser[]>([])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [actionUserID, setActionUserID] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim()
        if (prev !== next) {
          setPage(1)
        }
        return next
      })
    }, 320)

    return () => clearTimeout(timer)
  }, [searchInput])

  const loadUsers = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true

      if (silent) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await adminUserService.list({
          page,
          limit: PAGE_LIMIT,
          search: search || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        })

        if (!res.success) {
          setError(res.message || 'Gagal memuat pengguna admin')
          return
        }

        const normalized = (res.data || []).map((item) => ({
          ...item,
          total_orders: toSafeNumber(item.total_orders),
          paid_orders: toSafeNumber(item.paid_orders),
          total_spent: toSafeNumber(item.total_spent),
          active_orders: toSafeNumber(item.active_orders),
          wallet_balance: toSafeNumber(item.wallet_balance),
        }))

        setUsers(normalized)

        const totalData = res.meta?.total ?? normalized.length
        const resolvedTotalPages = Math.max(1, res.meta?.total_pages ?? 1)

        setTotal(totalData)
        setTotalPages(resolvedTotalPages)

        if (page > resolvedTotalPages) {
          setPage(resolvedTotalPages)
        }
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat daftar pengguna'))
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    [page, search, statusFilter]
  )

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!selectedUser && !confirmTarget) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmTarget) {
          setConfirmTarget(null)
          return
        }

        setSelectedUser(null)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [confirmTarget, selectedUser])

  const activeCount = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users]
  )

  const openBlockConfirm = (user: AdminUser) => {
    setConfirmTarget(user)
    setError('')
  }

  const toggleUserBlock = async () => {
    if (!confirmTarget) return

    setActionUserID(confirmTarget.id)
    setError('')

    try {
      const res = await adminUserService.toggleBlock(confirmTarget.id)
      if (!res.success) {
        setError(res.message || 'Gagal update status user')
        return
      }

      setNotice(
        res.data.is_active
          ? `User ${res.data.name} berhasil diaktifkan.`
          : `User ${res.data.name} berhasil dinonaktifkan.`
      )

      setConfirmTarget(null)
      setSelectedUser((prev) => {
        if (!prev || prev.id !== res.data.id) return prev

        return {
          ...prev,
          ...res.data,
          total_orders: prev.total_orders,
          paid_orders: prev.paid_orders,
          total_spent: prev.total_spent,
          active_orders: prev.active_orders,
          last_order_at: prev.last_order_at,
        }
      })

      await loadUsers({ silent: true })
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal update status user'))
    } finally {
      setActionUserID(null)
    }
  }

  const exportCsv = () => {
    if (!users.length) return

    const header = [
      'Nama',
      'Email',
      'Telepon',
      'Role',
      'Status',
      'Total Order',
      'Order Paid',
      'Order Active',
      'Total Belanja',
      'Saldo Wallet',
      'Terdaftar',
      'Order Terakhir',
    ]

    const rows = users.map((user) => [
      user.name || '-',
      user.email || '-',
      user.phone || '-',
      roleLabel(user.role),
      user.is_active ? 'Aktif' : 'Nonaktif',
      String(user.total_orders || 0),
      String(user.paid_orders || 0),
      String(user.active_orders || 0),
      String(user.total_spent || 0),
      String(user.wallet_balance || 0),
      formatDateTime(user.created_at),
      formatDateTime(user.last_order_at),
    ])

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => parseCsvCell(String(cell))).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `admin-users-page-${page}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    URL.revokeObjectURL(url)
  }

  const openUserDetail = (user: AdminUser) => {
    setSelectedUser(user)
    setError('')
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
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="🔍 Cari nama / email / telepon..."
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 310,
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter)
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
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="topbar-btn" onClick={() => loadUsers({ silent: true })} disabled={loading || syncing}>
              {syncing ? 'Menyegarkan...' : 'Refresh'}
            </button>
            <button className="topbar-btn primary" onClick={exportCsv} disabled={!users.length}>
              Export
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Daftar Pengguna</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Aktif halaman ini:{' '}
              <strong style={{ color: 'var(--dark)' }}>{activeCount}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Total Order</th>
                  <th>Total Belanja</th>
                  <th>Saldo Wallet</th>
                  <th>Terdaftar</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Tidak ada pengguna pada filter saat ini.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const status = statusMeta(user.is_active)
                    const isBusy = actionUserID === user.id

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="order-buyer">{user.name || '-'}</div>
                          <div className="order-email">{user.email || '-'}</div>
                          {user.phone && (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user.phone}</div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 600 }}>{user.total_orders || 0}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Paid {user.paid_orders || 0} · Active {user.active_orders || 0}
                          </div>
                        </td>

                        <td style={{ fontWeight: 600 }}>{formatRupiah(user.total_spent || 0)}</td>
                        <td style={{ fontWeight: 600 }}>{formatRupiah(user.wallet_balance || 0)}</td>

                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {formatDate(user.created_at)}
                        </td>

                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => openUserDetail(user)}>
                              Detail
                            </button>

                            <button
                              className={user.is_active ? 'g-reject' : 'g-approve'}
                              disabled={isBusy}
                              onClick={() => openBlockConfirm(user)}
                            >
                              {isBusy ? 'Proses...' : user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
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
              Menampilkan <strong style={{ color: 'var(--dark)' }}>{users.length}</strong> item · Page{' '}
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
            <div className="mobile-page-title">Pengguna</div>
            <div className="mobile-page-subtitle">Kontrol status akun pelanggan</div>
          </div>
          <button className="mobile-chip-btn" onClick={exportCsv} disabled={!users.length}>
            Export
          </button>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari nama / email / telepon"
            />

            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter)
                setPage(1)
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button className="mobile-chip-btn" onClick={() => loadUsers({ silent: true })} disabled={loading || syncing}>
              {syncing ? 'Sync...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Memuat daftar pengguna...</div>
            </article>
          ) : users.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada pengguna pada filter ini.</div>
            </article>
          ) : (
            users.map((user) => {
              const status = statusMeta(user.is_active)
              const isBusy = actionUserID === user.id

              return (
                <article className="mobile-card" key={user.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">{user.name || '-'}</div>
                      <div className="mobile-card-sub">{user.email || '-'}{user.phone ? ` · ${user.phone}` : ''}</div>
                    </div>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Role</span>
                    <span className="mobile-card-value">{roleLabel(user.role)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Total order</span>
                    <span className="mobile-card-value">{user.total_orders || 0}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Total belanja</span>
                    <span className="mobile-card-value">{formatRupiah(user.total_spent || 0)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Wallet</span>
                    <span className="mobile-card-value">{formatRupiah(user.wallet_balance || 0)}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Terdaftar</span>
                    <span className="mobile-card-value">{formatDate(user.created_at)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => openUserDetail(user)}>
                      Detail
                    </button>
                    <button
                      className={user.is_active ? 'g-reject' : 'g-approve'}
                      onClick={() => openBlockConfirm(user)}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Proses...' : user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="mobile-card" style={{ marginTop: 10 }}>
          <div className="mobile-card-row">
            <span className="mobile-card-label">Total pengguna</span>
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

      {selectedUser && (
        <div style={MODAL_OVERLAY_STYLE} onClick={() => setSelectedUser(null)}>
          <div className="card" style={MODAL_CARD_STYLE} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Detail Pengguna {shortUserCode(selectedUser.id)}</h2>
              <button className="action-btn" onClick={() => setSelectedUser(null)}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Nama</span>
                <span className="mobile-card-value">{selectedUser.name || '-'}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Email</span>
                <span className="mobile-card-value">{selectedUser.email || '-'}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Telepon</span>
                <span className="mobile-card-value">{selectedUser.phone || '-'}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Role</span>
                <span className="mobile-card-value">{roleLabel(selectedUser.role)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className={`status-badge ${statusMeta(selectedUser.is_active).className}`}>
                  {statusMeta(selectedUser.is_active).label}
                </span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Total Order</span>
                <span className="mobile-card-value">{selectedUser.total_orders || 0}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Order Paid</span>
                <span className="mobile-card-value">{selectedUser.paid_orders || 0}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Order Active</span>
                <span className="mobile-card-value">{selectedUser.active_orders || 0}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Total Belanja</span>
                <span className="mobile-card-value">{formatRupiah(selectedUser.total_spent || 0)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Wallet Balance</span>
                <span className="mobile-card-value">{formatRupiah(selectedUser.wallet_balance || 0)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Terdaftar</span>
                <span className="mobile-card-value">{formatDateTime(selectedUser.created_at)}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Order Terakhir</span>
                <span className="mobile-card-value">{formatDateTime(selectedUser.last_order_at)}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
                <button className="topbar-btn" onClick={() => setSelectedUser(null)}>
                  Tutup
                </button>
                <button
                  className={selectedUser.is_active ? 'g-reject' : 'g-approve'}
                  onClick={() => openBlockConfirm(selectedUser)}
                  disabled={actionUserID === selectedUser.id}
                >
                  {actionUserID === selectedUser.id ? 'Memproses...' : selectedUser.is_active ? 'Nonaktifkan User' : 'Aktifkan User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && (
        <div style={MODAL_OVERLAY_STYLE} onClick={() => setConfirmTarget(null)}>
          <div className="card" style={{ ...MODAL_CARD_STYLE, maxWidth: 520 }} onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>{confirmTarget.is_active ? 'Nonaktifkan User' : 'Aktifkan User'} {shortUserCode(confirmTarget.id)}</h2>
              <button className="action-btn" onClick={() => setConfirmTarget(null)} disabled={!!actionUserID}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {confirmTarget.is_active
                  ? `User ${confirmTarget.name || '-'} akan dinonaktifkan. User tidak bisa login sampai status diaktifkan lagi.`
                  : `User ${confirmTarget.name || '-'} akan diaktifkan kembali dan bisa login normal.`}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="action-btn" onClick={() => setConfirmTarget(null)} disabled={!!actionUserID}>
                  Batal
                </button>
                <button className="topbar-btn primary" onClick={toggleUserBlock} disabled={!!actionUserID}>
                  {actionUserID ? 'Memproses...' : confirmTarget.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
