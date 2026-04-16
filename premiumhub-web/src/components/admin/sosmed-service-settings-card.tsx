"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { productCategoryService } from '@/services/productCategoryService'
import {
  sosmedService,
  type AdminSosmedServicePayload,
  type AdminSosmedServiceUpdatePayload,
} from '@/services/sosmedService'
import type { ProductCategory } from '@/types/productCategory'
import type { SosmedService } from '@/types/sosmedService'

type FormMode = 'create' | 'edit'

type SosmedServiceFormState = {
  category_code: string
  code: string
  title: string
  summary: string
  platform_label: string
  badge_text: string
  theme: string
  min_order: string
  start_time: string
  refill: string
  eta: string
  price_start: string
  price_per_1k: string
  trust_badges_text: string
  sort_order: string
  is_active: boolean
}

const THEME_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'pink', label: 'Pink' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'purple', label: 'Purple' },
  { value: 'mint', label: 'Mint' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
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

function parseTrustBadges(value: string) {
  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return [...new Set(parts)].slice(0, 8)
}

function statusLabel(item: SosmedService) {
  if (!item.is_active) return { label: 'Nonaktif', className: 's-gagal' }
  return { label: 'Aktif', className: 's-lunas' }
}

function createEmptyForm(categoryCode: string): SosmedServiceFormState {
  return {
    category_code: categoryCode,
    code: '',
    title: '',
    summary: '',
    platform_label: '',
    badge_text: '',
    theme: 'blue',
    min_order: '',
    start_time: '',
    refill: '',
    eta: '',
    price_start: '',
    price_per_1k: '',
    trust_badges_text: '',
    sort_order: '100',
    is_active: true,
  }
}

export default function SosmedServiceSettingsCard() {
  const [items, setItems] = useState<SosmedService[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingItem, setEditingItem] = useState<SosmedService | null>(null)
  const [form, setForm] = useState<SosmedServiceFormState>(() => createEmptyForm(''))

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<SosmedService | null>(null)

  const categoryOptions = useMemo(
    () => categories.sort((left, right) => (left.sort_order || 100) - (right.sort_order || 100)),
    [categories]
  )

  const defaultCategoryCode = useMemo(() => {
    const active = categoryOptions.find((item) => item.is_active)
    return active?.code || categoryOptions[0]?.code || ''
  }, [categoryOptions])

  const categoryLabelMap = useMemo(() => {
    return categoryOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.code] = item.label || item.code
      return acc
    }, {})
  }, [categoryOptions])

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftSort = left.sort_order ?? 100
        const rightSort = right.sort_order ?? 100
        if (leftSort !== rightSort) return leftSort - rightSort
        return (left.code || '').localeCompare(right.code || '')
      }),
    [items]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [serviceRes, categoryRes] = await Promise.all([
        sosmedService.adminList({ include_inactive: true }),
        productCategoryService.adminList({ scope: 'sosmed', include_inactive: true }),
      ])

      if (!serviceRes.success) {
        setError(serviceRes.message || 'Gagal memuat layanan sosmed')
        return
      }
      if (!categoryRes.success) {
        setError(categoryRes.message || 'Gagal memuat kategori sosmed')
        return
      }

      setItems(serviceRes.data || [])
      setCategories(categoryRes.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat data layanan sosmed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

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
    setForm(createEmptyForm(defaultCategoryCode))
    setError('')
    setFormOpen(true)
  }

  const openEditForm = (item: SosmedService) => {
    setFormMode('edit')
    setEditingItem(item)
    setForm({
      category_code: item.category_code || defaultCategoryCode,
      code: item.code || '',
      title: item.title || '',
      summary: item.summary || '',
      platform_label: item.platform_label || '',
      badge_text: item.badge_text || '',
      theme: item.theme || 'blue',
      min_order: item.min_order || '',
      start_time: item.start_time || '',
      refill: item.refill || '',
      eta: item.eta || '',
      price_start: item.price_start || '',
      price_per_1k: item.price_per_1k || '',
      trust_badges_text: (item.trust_badges || []).join(', '),
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
    setForm(createEmptyForm(defaultCategoryCode))
  }

  const submitForm = async () => {
    const normalizedCode = normalizeCode(form.code)
    if (!form.category_code) {
      setError('Kategori sosmed wajib dipilih')
      return
    }
    if (!normalizedCode) {
      setError('Kode layanan wajib diisi')
      return
    }
    if (!form.title.trim()) {
      setError('Judul layanan wajib diisi')
      return
    }

    const sortOrder = Number(form.sort_order) || 100
    const trustBadges = parseTrustBadges(form.trust_badges_text)

    const payloadBase: AdminSosmedServicePayload = {
      category_code: form.category_code,
      code: normalizedCode,
      title: form.title.trim(),
      summary: form.summary.trim(),
      platform_label: form.platform_label.trim(),
      badge_text: form.badge_text.trim(),
      theme: form.theme,
      min_order: form.min_order.trim(),
      start_time: form.start_time.trim(),
      refill: form.refill.trim(),
      eta: form.eta.trim(),
      price_start: form.price_start.trim(),
      price_per_1k: form.price_per_1k.trim(),
      trust_badges: trustBadges,
      sort_order: sortOrder,
      is_active: form.is_active,
    }

    setSaving(true)
    setError('')

    try {
      if (formMode === 'create') {
        const res = await sosmedService.adminCreate(payloadBase)
        if (!res.success) {
          setError(res.message || 'Gagal membuat layanan sosmed')
          return
        }

        setNotice(`Layanan "${res.data.title}" berhasil dibuat.`)
      } else if (editingItem) {
        const payload: AdminSosmedServiceUpdatePayload = {
          category_code: payloadBase.category_code,
          code: payloadBase.code,
          title: payloadBase.title,
          summary: payloadBase.summary,
          platform_label: payloadBase.platform_label,
          badge_text: payloadBase.badge_text,
          theme: payloadBase.theme,
          min_order: payloadBase.min_order,
          start_time: payloadBase.start_time,
          refill: payloadBase.refill,
          eta: payloadBase.eta,
          price_start: payloadBase.price_start,
          price_per_1k: payloadBase.price_per_1k,
          trust_badges: payloadBase.trust_badges,
          sort_order: payloadBase.sort_order,
          is_active: payloadBase.is_active,
        }

        const res = await sosmedService.adminUpdate(editingItem.id, payload)
        if (!res.success) {
          setError(res.message || 'Gagal memperbarui layanan sosmed')
          return
        }

        setNotice(`Layanan "${res.data.title}" berhasil diperbarui.`)
      }

      closeForm()
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan layanan sosmed'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: SosmedService) => {
    setSaving(true)
    setError('')

    try {
      const res = await sosmedService.adminUpdate(item.id, { is_active: !item.is_active })
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status layanan')
        return
      }

      setNotice(
        !item.is_active
          ? `Layanan "${item.title}" diaktifkan.`
          : `Layanan "${item.title}" dinonaktifkan.`
      )
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status layanan'))
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (item: SosmedService) => {
    setConfirmTarget(item)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!confirmTarget) return

    setSaving(true)
    setError('')
    setConfirmOpen(false)

    try {
      const res = await sosmedService.adminDelete(confirmTarget.id)
      if (!res.success) {
        setError(res.message || 'Gagal menonaktifkan layanan')
        return
      }

      setNotice(`Layanan "${confirmTarget.title}" berhasil dinonaktifkan.`)
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menonaktifkan layanan'))
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
            <h2>Master Layanan Sosmed</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Konten card di /product/sosmed diambil langsung dari master layanan ini.
            </div>
          </div>

          <button className="topbar-btn primary" type="button" onClick={openCreateForm}>
            + Tambah Layanan
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
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat layanan sosmed...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada layanan sosmed.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Layanan</th>
                    <th>Kategori</th>
                    <th>Harga Mulai</th>
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
                          <div style={{ fontWeight: 600 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {item.platform_label || '-'} • {item.badge_text || '-'}
                          </div>
                        </td>
                        <td>{categoryLabelMap[item.category_code] || item.category_code || '-'}</td>
                        <td>{item.price_start || '-'}</td>
                        <td>{item.sort_order ?? 100}</td>
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
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(760px, 96vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>{formMode === 'create' ? 'Tambah Layanan Sosmed' : 'Edit Layanan Sosmed'}</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>Kode layanan permanen setelah dibuat.</div>
              </div>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeForm}>×</button>
            </div>

            <div className="modal-body" style={MODAL_BODY_STYLE}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Kategori</label>
                  <select
                    className="form-select"
                    value={form.category_code}
                    onChange={(event) => setForm((prev) => ({ ...prev, category_code: event.target.value }))}
                  >
                    <option value="">Pilih kategori</option>
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.code}>
                        {option.label}{option.is_active ? '' : ' (nonaktif)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Kode</label>
                  <input
                    className="form-input"
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: normalizeCode(event.target.value) }))}
                    disabled={formMode === 'edit'}
                    placeholder="contoh: ig-followers-id"
                  />
                </div>

                <div>
                  <label className="form-label">Theme</label>
                  <select
                    className="form-select"
                    value={form.theme}
                    onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value }))}
                  >
                    {THEME_OPTIONS.map((theme) => (
                      <option key={theme.value} value={theme.value}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Judul Layanan</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Contoh: IG Followers Indonesia Aktif"
                />
              </div>

              <div>
                <label className="form-label">Summary</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Deskripsi singkat layanan"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Platform Label</label>
                  <input
                    className="form-input"
                    value={form.platform_label}
                    onChange={(event) => setForm((prev) => ({ ...prev, platform_label: event.target.value }))}
                    placeholder="Instagram"
                  />
                </div>

                <div>
                  <label className="form-label">Badge Text</label>
                  <input
                    className="form-input"
                    value={form.badge_text}
                    onChange={(event) => setForm((prev) => ({ ...prev, badge_text: event.target.value }))}
                    placeholder="Best Seller"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Min Order</label>
                  <input
                    className="form-input"
                    value={form.min_order}
                    onChange={(event) => setForm((prev) => ({ ...prev, min_order: event.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="form-label">Start Time</label>
                  <input
                    className="form-input"
                    value={form.start_time}
                    onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                    placeholder="5-15 menit"
                  />
                </div>
                <div>
                  <label className="form-label">Refill</label>
                  <input
                    className="form-input"
                    value={form.refill}
                    onChange={(event) => setForm((prev) => ({ ...prev, refill: event.target.value }))}
                    placeholder="30 hari"
                  />
                </div>
                <div>
                  <label className="form-label">ETA</label>
                  <input
                    className="form-input"
                    value={form.eta}
                    onChange={(event) => setForm((prev) => ({ ...prev, eta: event.target.value }))}
                    placeholder="2-12 jam"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Harga Mulai</label>
                  <input
                    className="form-input"
                    value={form.price_start}
                    onChange={(event) => setForm((prev) => ({ ...prev, price_start: event.target.value }))}
                    placeholder="Rp 28.000"
                  />
                </div>
                <div>
                  <label className="form-label">Harga per 1K</label>
                  <input
                    className="form-input"
                    value={form.price_per_1k}
                    onChange={(event) => setForm((prev) => ({ ...prev, price_per_1k: event.target.value }))}
                    placeholder="≈ Rp 28 / 1K"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Trust Badges (pisah koma)</label>
                <input
                  className="form-input"
                  value={form.trust_badges_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, trust_badges_text: event.target.value }))}
                  placeholder="No Password, Gradual Delivery, Refill 30 Hari"
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Aktif untuk tampil di /product/sosmed
              </label>
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closeForm} disabled={saving}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={submitForm} disabled={saving}>
                {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Layanan' : 'Update Layanan'}
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
              <h3>Nonaktifkan Layanan</h3>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setConfirmOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ ...MODAL_BODY_STYLE, fontSize: 13, color: 'var(--text)' }}>
              Layanan <strong>{confirmTarget.title}</strong> akan dinonaktifkan dari katalog sosmed.
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
