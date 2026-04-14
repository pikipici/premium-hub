"use client"

import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

import MaintenanceSettingsCard from '@/components/admin/maintenance-settings-card'
import {
  accountTypeService,
  type AdminAccountTypePayload,
  type AdminAccountTypeUpdatePayload,
} from '@/services/accountTypeService'
import type { AccountType } from '@/types/accountType'

type FormMode = 'create' | 'edit'

type AccountTypeFormState = {
  code: string
  label: string
  description: string
  sort_order: string
  badge_bg_color: string
  badge_text_color: string
  is_active: boolean
}

const EMPTY_FORM: AccountTypeFormState = {
  code: '',
  label: '',
  description: '',
  sort_order: '100',
  badge_bg_color: '',
  badge_text_color: '',
  is_active: true,
}

const MODAL_OVERLAY_STYLE = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(15, 23, 42, 0.48)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 14px',
  zIndex: 9999,
}

const MODAL_CARD_BASE_STYLE = {
  background: 'var(--card, #fff)',
  border: '1px solid var(--line, #E5E7EB)',
  borderRadius: 16,
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
  maxHeight: 'calc(100vh - 40px)',
  overflow: 'auto' as const,
}

const MODAL_HEAD_STYLE = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  padding: '16px 18px 10px',
  borderBottom: '1px solid var(--line, #E5E7EB)',
}

const MODAL_SUB_STYLE = {
  fontSize: 12,
  color: 'var(--muted)',
}

const MODAL_CLOSE_STYLE = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid var(--line, #E5E7EB)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
}

const MODAL_BODY_STYLE = {
  display: 'grid',
  gap: 10,
  padding: '14px 18px',
}

const MODAL_ACTIONS_STYLE = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 18px 16px',
  borderTop: '1px solid var(--line, #E5E7EB)',
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
}

function normalizeCode(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

function statusLabel(item: AccountType) {
  if (!item.is_active) return { label: 'Nonaktif', className: 's-gagal' }
  if (item.is_system) return { label: 'Sistem', className: 's-lunas' }
  return { label: 'Aktif', className: 's-pending' }
}

export default function PengaturanPage() {
  const [items, setItems] = useState<AccountType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingItem, setEditingItem] = useState<AccountType | null>(null)
  const [form, setForm] = useState<AccountTypeFormState>(EMPTY_FORM)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<AccountType | null>(null)

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order
        }
        return left.code.localeCompare(right.code)
      }),
    [items]
  )

  const loadAccountTypes = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await accountTypeService.adminList({ include_inactive: true })
      if (!res.success) {
        setError(res.message || 'Gagal memuat master tipe akun')
        return
      }
      setItems(res.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat master tipe akun'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccountTypes()
  }, [])

  useEffect(() => {
    if (!formOpen && !confirmOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [confirmOpen, formOpen])

  const openCreateForm = () => {
    setFormMode('create')
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setError('')
    setFormOpen(true)
  }

  const openEditForm = (item: AccountType) => {
    setFormMode('edit')
    setEditingItem(item)
    setForm({
      code: item.code,
      label: item.label || '',
      description: item.description || '',
      sort_order: String(item.sort_order ?? 100),
      badge_bg_color: item.badge_bg_color || '',
      badge_text_color: item.badge_text_color || '',
      is_active: item.is_active,
    })
    setError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditingItem(null)
    setForm(EMPTY_FORM)
  }

  const submitForm = async () => {
    const normalizedCode = normalizeCode(form.code)
    if (!normalizedCode) {
      setError('Kode tipe akun wajib diisi')
      return
    }

    if (!form.label.trim()) {
      setError('Label tipe akun wajib diisi')
      return
    }

    const sortOrder = Number(form.sort_order) || 100

    const payloadBase: AdminAccountTypePayload = {
      code: normalizedCode,
      label: form.label.trim(),
      description: form.description.trim(),
      sort_order: sortOrder,
      badge_bg_color: form.badge_bg_color.trim(),
      badge_text_color: form.badge_text_color.trim(),
      is_active: form.is_active,
    }

    setSaving(true)
    setError('')

    try {
      if (formMode === 'create') {
        const res = await accountTypeService.adminCreate(payloadBase)
        if (!res.success) {
          setError(res.message || 'Gagal membuat tipe akun')
          return
        }
        setNotice(`Tipe akun "${res.data.label}" berhasil dibuat.`)
      } else if (editingItem) {
        const payload: AdminAccountTypeUpdatePayload = {
          code: normalizedCode,
          label: payloadBase.label,
          description: payloadBase.description,
          sort_order: payloadBase.sort_order,
          badge_bg_color: payloadBase.badge_bg_color,
          badge_text_color: payloadBase.badge_text_color,
          is_active: payloadBase.is_active,
        }

        const res = await accountTypeService.adminUpdate(editingItem.id, payload)
        if (!res.success) {
          setError(res.message || 'Gagal memperbarui tipe akun')
          return
        }
        setNotice(`Tipe akun "${res.data.label}" berhasil diperbarui.`)
      }

      closeForm()
      await loadAccountTypes()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan tipe akun'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: AccountType) => {
    setSaving(true)
    setError('')

    try {
      const res = await accountTypeService.adminUpdate(item.id, { is_active: !item.is_active })
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status tipe akun')
        return
      }

      setNotice(
        !item.is_active
          ? `Tipe akun "${item.label}" diaktifkan.`
          : `Tipe akun "${item.label}" dinonaktifkan.`
      )
      await loadAccountTypes()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status tipe akun'))
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (item: AccountType) => {
    setConfirmTarget(item)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!confirmTarget) return

    setSaving(true)
    setError('')
    setConfirmOpen(false)

    try {
      const res = await accountTypeService.adminDelete(confirmTarget.id)
      if (!res.success) {
        setError(res.message || 'Gagal menonaktifkan tipe akun')
        return
      }

      setNotice(`Tipe akun "${confirmTarget.label}" berhasil dinonaktifkan.`)
      await loadAccountTypes()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menonaktifkan tipe akun'))
    } finally {
      setSaving(false)
      setConfirmTarget(null)
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2>Master Tipe Akun</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Semua paket harga dan stok akun wajib pakai tipe dari master ini.
            </div>
          </div>

          <button className="topbar-btn primary" type="button" onClick={openCreateForm}>
            + Tambah Tipe Akun
          </button>
        </div>

        {(error || notice) && (
          <div style={{ padding: '0 18px 12px' }}>
            {error && (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}
            {notice && <div className="alert success">{notice}</div>}
          </div>
        )}

        <div style={{ padding: '0 18px 18px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat master tipe akun...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada tipe akun.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Label</th>
                    <th>Urutan</th>
                    <th>Badge</th>
                    <th>Status</th>
                    <th style={{ width: 200 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const status = statusLabel(item)

                    return (
                      <tr key={item.id}>
                        <td>
                          <code>{item.code}</code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.label}</div>
                          {item.description && (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.description}</div>
                          )}
                        </td>
                        <td>{item.sort_order}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: 999,
                              border: `1px solid ${item.badge_bg_color || '#D0D5DD'}`,
                              background: item.badge_bg_color ? `${item.badge_bg_color}1F` : '#F9FAFB',
                              color: item.badge_text_color || '#475467',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {item.label}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" type="button" onClick={() => openEditForm(item)}>
                              Edit
                            </button>
                            {!item.is_system && (
                              <button className="action-btn" type="button" onClick={() => toggleActive(item)}>
                                {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                            {!item.is_system && (
                              <button
                                className="action-btn"
                                type="button"
                                style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                                onClick={() => requestDelete(item)}
                              >
                                Hapus
                              </button>
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
      </div>

      <MaintenanceSettingsCard />

      {formOpen && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeForm}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(620px, 95vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>{formMode === 'create' ? 'Tambah Tipe Akun' : 'Edit Tipe Akun'}</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>Kode bersifat permanen setelah dibuat.</div>
              </div>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeForm}>×</button>
            </div>

            <div className="modal-body" style={MODAL_BODY_STYLE}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Kode</label>
                  <input
                    className="form-input"
                    value={form.code}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        code: normalizeCode(event.target.value),
                      }))
                    }
                    disabled={formMode === 'edit'}
                    placeholder="contoh: shared"
                  />
                </div>

                <div>
                  <label className="form-label">Urutan</label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.sort_order}
                    onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Label</label>
                <input
                  className="form-input"
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Shared · Akun Bersama"
                />
              </div>

              <div>
                <label className="form-label">Deskripsi</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Opsional"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Warna Badge Background</label>
                  <input
                    className="form-input"
                    value={form.badge_bg_color}
                    onChange={(event) => setForm((prev) => ({ ...prev, badge_bg_color: event.target.value }))}
                    placeholder="#ECFDF5"
                  />
                </div>
                <div>
                  <label className="form-label">Warna Badge Text</label>
                  <input
                    className="form-input"
                    value={form.badge_text_color}
                    onChange={(event) => setForm((prev) => ({ ...prev, badge_text_color: event.target.value }))}
                    placeholder="#047857"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  disabled={editingItem?.is_system}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Aktif untuk dipakai pada harga & stok
              </label>
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closeForm} disabled={saving}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={submitForm} disabled={saving}>
                {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Tipe Akun' : 'Update Tipe Akun'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && confirmTarget && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={() => setConfirmOpen(false)}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(460px, 94vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <h3>Nonaktifkan Tipe Akun</h3>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setConfirmOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ ...MODAL_BODY_STYLE, fontSize: 13, color: 'var(--text)' }}>
              Tipe akun <strong>{confirmTarget.label}</strong> akan dinonaktifkan dari input admin.
            </div>
            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={() => setConfirmOpen(false)}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={confirmDelete}>
                Ya, Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
