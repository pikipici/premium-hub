"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  productCategoryService,
  type AdminProductCategoryPayload,
  type AdminProductCategoryUpdatePayload,
} from '@/services/productCategoryService'
import type { ProductCategory, ProductCategoryScope } from '@/types/productCategory'

type FormMode = 'create' | 'edit'

type CategoryFormState = {
  code: string
  label: string
  description: string
  sort_order: string
  is_active: boolean
}

const EMPTY_FORM: CategoryFormState = {
  code: '',
  label: '',
  description: '',
  sort_order: '100',
  is_active: true,
}

const SCOPE_OPTIONS: Array<{ value: ProductCategoryScope; label: string; desc: string }> = [
  {
    value: 'prem_apps',
    label: 'Product Apps',
    desc: 'Kategori untuk katalog /product/prem-apps',
  },
  {
    value: 'sosmed',
    label: 'Sosmed SMM',
    desc: 'Kategori untuk katalog /product/sosmed',
  },
]

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

function statusLabel(item: ProductCategory) {
  if (!item.is_active) return { label: 'Nonaktif', className: 's-gagal' }
  return { label: 'Aktif', className: 's-lunas' }
}

export default function ProductCategorySettingsCard() {
  const [scope, setScope] = useState<ProductCategoryScope>('prem_apps')
  const [items, setItems] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingItem, setEditingItem] = useState<ProductCategory | null>(null)
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<ProductCategory | null>(null)

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

  const activeScopeMeta = useMemo(
    () => SCOPE_OPTIONS.find((item) => item.value === scope) || SCOPE_OPTIONS[0],
    [scope]
  )

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await productCategoryService.adminList({
        scope,
        include_inactive: true,
      })

      if (!res.success) {
        setError(res.message || 'Gagal memuat master kategori')
        return
      }

      setItems(res.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat master kategori'))
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

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

  const openEditForm = (item: ProductCategory) => {
    setFormMode('edit')
    setEditingItem(item)
    setForm({
      code: item.code,
      label: item.label || '',
      description: item.description || '',
      sort_order: String(item.sort_order ?? 100),
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
      setError('Kode kategori wajib diisi')
      return
    }

    if (!form.label.trim()) {
      setError('Label kategori wajib diisi')
      return
    }

    const sortOrder = Number(form.sort_order) || 100

    const payloadBase: AdminProductCategoryPayload = {
      scope,
      code: normalizedCode,
      label: form.label.trim(),
      description: form.description.trim(),
      sort_order: sortOrder,
      is_active: form.is_active,
    }

    setSaving(true)
    setError('')

    try {
      if (formMode === 'create') {
        const res = await productCategoryService.adminCreate(payloadBase)
        if (!res.success) {
          setError(res.message || 'Gagal membuat kategori')
          return
        }

        setNotice(`Kategori "${res.data.label}" berhasil dibuat.`)
      } else if (editingItem) {
        const payload: AdminProductCategoryUpdatePayload = {
          code: normalizedCode,
          label: payloadBase.label,
          description: payloadBase.description,
          sort_order: payloadBase.sort_order,
          is_active: payloadBase.is_active,
        }

        const res = await productCategoryService.adminUpdate(editingItem.id, payload)
        if (!res.success) {
          setError(res.message || 'Gagal memperbarui kategori')
          return
        }

        setNotice(`Kategori "${res.data.label}" berhasil diperbarui.`)
      }

      closeForm()
      await loadCategories()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan kategori'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: ProductCategory) => {
    setSaving(true)
    setError('')

    try {
      const res = await productCategoryService.adminUpdate(item.id, { is_active: !item.is_active })
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status kategori')
        return
      }

      setNotice(
        !item.is_active
          ? `Kategori "${item.label}" diaktifkan.`
          : `Kategori "${item.label}" dinonaktifkan.`
      )
      await loadCategories()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status kategori'))
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (item: ProductCategory) => {
    setConfirmTarget(item)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!confirmTarget) return

    setSaving(true)
    setError('')
    setConfirmOpen(false)

    try {
      const res = await productCategoryService.adminDelete(confirmTarget.id)
      if (!res.success) {
        setError(res.message || 'Gagal menonaktifkan kategori')
        return
      }

      setNotice(`Kategori "${confirmTarget.label}" berhasil dinonaktifkan.`)
      await loadCategories()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menonaktifkan kategori'))
    } finally {
      setSaving(false)
      setConfirmTarget(null)
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2>Master Kategori Product & Sosmed</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Kategori bisa lu tambah/edit/nonaktifkan untuk prem-apps dan sosmed dari satu tempat.
            </div>
          </div>

          <button className="topbar-btn primary" type="button" onClick={openCreateForm}>
            + Tambah Kategori
          </button>
        </div>

        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SCOPE_OPTIONS.map((item) => {
            const active = scope === item.value
            return (
              <button
                key={item.value}
                type="button"
                className="action-btn"
                style={
                  active
                    ? {
                        background: '#141414',
                        borderColor: '#141414',
                        color: '#fff',
                      }
                    : undefined
                }
                onClick={() => setScope(item.value)}
              >
                {item.label}
              </button>
            )
          })}
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>{activeScopeMeta.desc}</span>
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
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat master kategori...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada kategori.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Label</th>
                    <th>Urutan</th>
                    <th>Status</th>
                    <th style={{ width: 220 }}>Aksi</th>
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
                          <span className={`status ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" type="button" onClick={() => openEditForm(item)}>
                              Edit
                            </button>
                            <button className="action-btn" type="button" onClick={() => toggleActive(item)}>
                              {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              className="action-btn"
                              type="button"
                              style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                              onClick={() => requestDelete(item)}
                            >
                              Hapus
                            </button>
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

      {formOpen && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeForm}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(620px, 95vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>{formMode === 'create' ? 'Tambah Kategori' : 'Edit Kategori'}</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>Scope aktif: {activeScopeMeta.label}. Kode permanen setelah dibuat.</div>
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
                    placeholder="contoh: streaming"
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
                  placeholder="Contoh: Streaming"
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

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Aktif untuk dipakai di katalog
              </label>
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closeForm} disabled={saving}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={submitForm} disabled={saving}>
                {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Kategori' : 'Update Kategori'}
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
              <h3>Nonaktifkan Kategori</h3>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setConfirmOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ ...MODAL_BODY_STYLE, fontSize: 13, color: 'var(--text)' }}>
              Kategori <strong>{confirmTarget.label}</strong> akan dinonaktifkan dari input admin.
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
    </>
  )
}
