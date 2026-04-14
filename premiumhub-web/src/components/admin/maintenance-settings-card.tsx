"use client"

import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

import {
  maintenanceService,
  type AdminMaintenanceRulePayload,
  type AdminMaintenanceRuleUpdatePayload,
} from '@/services/maintenanceService'
import type { MaintenanceRule, MaintenanceTargetType } from '@/types/maintenance'

type FormMode = 'create' | 'edit'

type MaintenancePreset = {
  key: 'product' | 'convert' | 'global'
  buttonLabel: string
  name: string
  target_type: MaintenanceTargetType
  target_path: string
  title: string
  message: string
}

type MaintenanceFormState = {
  name: string
  target_type: MaintenanceTargetType
  target_path: string
  title: string
  message: string
  is_active: boolean
  allow_admin_bypass: boolean
  starts_at: string
  ends_at: string
}

const TARGET_OPTIONS: Array<{ value: MaintenanceTargetType; label: string; hint: string }> = [
  { value: 'global', label: 'Global', hint: 'Semua halaman user non-admin' },
  { value: 'prefix', label: 'Prefix Path', hint: 'Contoh: /product untuk semua child path' },
  { value: 'exact', label: 'Exact Path', hint: 'Contoh: /faq untuk 1 halaman spesifik' },
]

const EMPTY_FORM: MaintenanceFormState = {
  name: '',
  target_type: 'global',
  target_path: '/',
  title: '',
  message: '',
  is_active: false,
  allow_admin_bypass: true,
  starts_at: '',
  ends_at: '',
}

const MAINTENANCE_PRESETS: MaintenancePreset[] = [
  {
    key: 'product',
    buttonLabel: 'Maintenance Produk',
    name: 'Preset • Maintenance Produk',
    target_type: 'prefix',
    target_path: '/product/prem-apps',
    title: 'Halaman Produk Sedang Maintenance',
    message: 'Halaman produk lagi kami update sebentar. Coba lagi beberapa saat ya.',
  },
  {
    key: 'convert',
    buttonLabel: 'Maintenance Convert',
    name: 'Preset • Maintenance Convert',
    target_type: 'prefix',
    target_path: '/product/convert',
    title: 'Halaman Convert Sedang Maintenance',
    message: 'Fitur convert lagi maintenance sebentar. Coba lagi beberapa saat ya.',
  },
  {
    key: 'global',
    buttonLabel: 'Maintenance Semua Halaman',
    name: 'Preset • Maintenance Semua Halaman',
    target_type: 'global',
    target_path: '/',
    title: 'Website Sedang Maintenance',
    message: 'Kami sedang maintenance sistem untuk peningkatan layanan. Mohon coba lagi sebentar.',
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

function toDateTimeLocalInput(value?: string | null) {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  if (!value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizeTargetPath(value: string, targetType: MaintenanceTargetType) {
  if (targetType === 'global') return '/'

  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed}`
}

function targetLabel(rule: MaintenanceRule) {
  if (rule.target_type === 'global') return 'Global · Semua halaman user'
  if (rule.target_type === 'prefix') return `Prefix · ${rule.target_path}`
  return `Exact · ${rule.target_path}`
}

function scheduleLabel(rule: MaintenanceRule) {
  if (!rule.starts_at && !rule.ends_at) return 'Tanpa jadwal'

  const format = (value?: string | null) => {
    if (!value) return '-'

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '-'

    return parsed.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (rule.starts_at && rule.ends_at) {
    return `${format(rule.starts_at)} → ${format(rule.ends_at)}`
  }

  if (rule.starts_at) {
    return `Mulai ${format(rule.starts_at)}`
  }

  return `Sampai ${format(rule.ends_at)}`
}

function statusMeta(rule: MaintenanceRule) {
  if (!rule.is_active) return { className: 's-gagal', label: 'Nonaktif' }
  return { className: 's-pending', label: 'Aktif' }
}

export default function MaintenanceSettingsCard() {
  const [rules, setRules] = useState<MaintenanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingRule, setEditingRule] = useState<MaintenanceRule | null>(null)
  const [form, setForm] = useState<MaintenanceFormState>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRule | null>(null)
  const [presetLoadingKey, setPresetLoadingKey] = useState<MaintenancePreset['key'] | null>(null)

  const sortedRules = useMemo(() => {
    return [...rules].sort((left, right) => {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1
      }
      return left.created_at < right.created_at ? 1 : -1
    })
  }, [rules])

  const loadRules = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await maintenanceService.adminList({ include_inactive: true })
      if (!res.success) {
        setError(res.message || 'Gagal memuat rule maintenance')
        return
      }

      setRules(res.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat rule maintenance'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRules()
  }, [])

  useEffect(() => {
    if (!formOpen && !deleteTarget) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [deleteTarget, formOpen])

  const openCreate = () => {
    setFormMode('create')
    setEditingRule(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
    setError('')
  }

  const openEdit = (rule: MaintenanceRule) => {
    setFormMode('edit')
    setEditingRule(rule)
    setForm({
      name: rule.name || '',
      target_type: rule.target_type,
      target_path: rule.target_path || '/',
      title: rule.title || '',
      message: rule.message || '',
      is_active: !!rule.is_active,
      allow_admin_bypass: rule.allow_admin_bypass !== false,
      starts_at: toDateTimeLocalInput(rule.starts_at),
      ends_at: toDateTimeLocalInput(rule.ends_at),
    })
    setFormOpen(true)
    setError('')
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditingRule(null)
    setForm(EMPTY_FORM)
  }

  const submitForm = async () => {
    const name = form.name.trim()
    if (!name) {
      setError('Nama rule maintenance wajib diisi.')
      return
    }

    const targetPath = normalizeTargetPath(form.target_path, form.target_type)
    if (form.target_type !== 'global' && !targetPath) {
      setError('Target path wajib diisi untuk mode prefix/exact.')
      return
    }

    const startsAtIso = toIsoDateTime(form.starts_at)
    const endsAtIso = toIsoDateTime(form.ends_at)
    if (startsAtIso && endsAtIso && new Date(endsAtIso) <= new Date(startsAtIso)) {
      setError('Waktu akhir harus lebih besar dari waktu mulai.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (formMode === 'create') {
        const payload: AdminMaintenanceRulePayload = {
          name,
          target_type: form.target_type,
          target_path: targetPath,
          title: form.title.trim(),
          message: form.message.trim(),
          is_active: form.is_active,
          allow_admin_bypass: form.allow_admin_bypass,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
        }

        const res = await maintenanceService.adminCreate(payload)
        if (!res.success) {
          setError(res.message || 'Gagal membuat rule maintenance')
          return
        }

        setNotice(`Rule maintenance "${res.data.name}" berhasil dibuat.`)
      } else if (editingRule) {
        const payload: AdminMaintenanceRuleUpdatePayload = {
          name,
          target_type: form.target_type,
          target_path: targetPath,
          title: form.title.trim(),
          message: form.message.trim(),
          is_active: form.is_active,
          allow_admin_bypass: form.allow_admin_bypass,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          clear_starts_at: !startsAtIso && !!editingRule.starts_at,
          clear_ends_at: !endsAtIso && !!editingRule.ends_at,
        }

        const res = await maintenanceService.adminUpdate(editingRule.id, payload)
        if (!res.success) {
          setError(res.message || 'Gagal memperbarui rule maintenance')
          return
        }

        setNotice(`Rule maintenance "${res.data.name}" berhasil diperbarui.`)
      }

      closeForm()
      await loadRules()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan rule maintenance'))
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: MaintenanceRule) => {
    setSaving(true)
    setError('')

    try {
      const res = await maintenanceService.adminUpdate(rule.id, {
        is_active: !rule.is_active,
      })
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status rule')
        return
      }

      setNotice(
        !rule.is_active
          ? `Rule "${rule.name}" diaktifkan.`
          : `Rule "${rule.name}" dinonaktifkan.`
      )

      await loadRules()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status rule maintenance'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setSaving(true)
    setError('')

    try {
      const res = await maintenanceService.adminDelete(deleteTarget.id)
      if (!res.success) {
        setError(res.message || 'Gagal menghapus rule maintenance')
        return
      }

      setNotice(`Rule "${deleteTarget.name}" berhasil dihapus.`)
      setDeleteTarget(null)
      await loadRules()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menghapus rule maintenance'))
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = async (preset: MaintenancePreset) => {
    if (presetLoadingKey) return

    setPresetLoadingKey(preset.key)
    setError('')

    try {
      const existing = rules.find((rule) => rule.name.trim().toLowerCase() === preset.name.trim().toLowerCase())

      if (!existing) {
        const payload: AdminMaintenanceRulePayload = {
          name: preset.name,
          target_type: preset.target_type,
          target_path: preset.target_path,
          title: preset.title,
          message: preset.message,
          is_active: true,
          allow_admin_bypass: true,
        }

        const res = await maintenanceService.adminCreate(payload)
        if (!res.success) {
          setError(res.message || 'Gagal menerapkan preset maintenance')
          return
        }

        setNotice(`Preset "${preset.buttonLabel}" berhasil diaktifkan.`)
      } else {
        const payload: AdminMaintenanceRuleUpdatePayload = {
          name: preset.name,
          target_type: preset.target_type,
          target_path: preset.target_path,
          title: preset.title,
          message: preset.message,
          is_active: true,
          allow_admin_bypass: true,
          clear_starts_at: !!existing.starts_at,
          clear_ends_at: !!existing.ends_at,
        }

        const res = await maintenanceService.adminUpdate(existing.id, payload)
        if (!res.success) {
          setError(res.message || 'Gagal menerapkan preset maintenance')
          return
        }

        setNotice(`Preset "${preset.buttonLabel}" berhasil diperbarui & diaktifkan.`)
      }

      await loadRules()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menerapkan preset maintenance'))
    } finally {
      setPresetLoadingKey(null)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2>Maintenance Halaman</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Kontrol ON/OFF maintenance per halaman dengan pesan custom ke user.
          </div>
        </div>

        <button className="topbar-btn primary" type="button" onClick={openCreate}>
          + Tambah Rule Maintenance
        </button>
      </div>

      <div style={{ padding: '0 18px 12px' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
          Preset Cepat (1 klik)
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MAINTENANCE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              className="action-btn"
              type="button"
              disabled={!!presetLoadingKey}
              onClick={() => applyPreset(preset)}
              style={{
                borderColor: '#FED7AA',
                background: '#FFF7ED',
                color: '#9A3412',
                fontWeight: 600,
              }}
            >
              {presetLoadingKey === preset.key ? 'Memproses...' : preset.buttonLabel}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
          Preset otomatis aktif, tanpa jadwal, dan admin bypass tetap ON.
        </div>
      </div>

      {(error || notice) && (
        <div style={{ padding: '0 18px 12px' }}>
          {error && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          {notice && <div className="alert success">{notice}</div>}
        </div>
      )}

      <div style={{ padding: '0 18px 18px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat rule maintenance...</div>
        ) : sortedRules.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada rule maintenance.</div>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Target</th>
                  <th>Jadwal</th>
                  <th>Status</th>
                  <th style={{ width: 240 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedRules.map((rule) => {
                  const status = statusMeta(rule)

                  return (
                    <tr key={rule.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{rule.name}</div>
                        {rule.message && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{rule.message.slice(0, 96)}{rule.message.length > 96 ? '…' : ''}</div>
                        )}
                      </td>
                      <td>
                        <div>{targetLabel(rule)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {rule.allow_admin_bypass ? 'Admin bypass: ON' : 'Admin bypass: OFF'}
                        </div>
                      </td>
                      <td>{scheduleLabel(rule)}</td>
                      <td>
                        <span className={`status ${status.className}`}>{status.label}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="action-btn" type="button" onClick={() => openEdit(rule)}>
                            Edit
                          </button>
                          <button className="action-btn" type="button" onClick={() => toggleRule(rule)}>
                            {rule.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            className="action-btn"
                            type="button"
                            style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                            onClick={() => setDeleteTarget(rule)}
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

      {formOpen && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeForm}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(760px, 96vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>{formMode === 'create' ? 'Tambah Rule Maintenance' : 'Edit Rule Maintenance'}</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>
                  Gunakan rule global/prefix/exact untuk target halaman maintenance.
                </div>
              </div>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeForm}>
                ×
              </button>
            </div>

            <div className="modal-body" style={MODAL_BODY_STYLE}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Nama Rule</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Contoh: Maintenance Produk Premium"
                  />
                </div>

                <div>
                  <label className="form-label">Target Type</label>
                  <select
                    className="form-select"
                    value={form.target_type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        target_type: event.target.value as MaintenanceTargetType,
                        target_path: event.target.value === 'global' ? '/' : prev.target_path,
                      }))
                    }
                  >
                    {TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {TARGET_OPTIONS.find((item) => item.value === form.target_type)?.hint}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Target Path</label>
                <input
                  className="form-input"
                  value={form.target_type === 'global' ? '/' : form.target_path}
                  disabled={form.target_type === 'global'}
                  onChange={(event) => setForm((prev) => ({ ...prev, target_path: event.target.value }))}
                  placeholder="Contoh: /product/prem-apps"
                />
              </div>

              <div>
                <label className="form-label">Judul Maintenance</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Contoh: Halaman Produk Sedang Maintenance"
                />
              </div>

              <div>
                <label className="form-label">Pesan ke User</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  placeholder="Contoh: Kami lagi update katalog premium, coba lagi jam 03:30 WIB ya."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Mulai Maintenance (opsional)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Selesai Maintenance (opsional)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                Aktifkan rule maintenance ini
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.allow_admin_bypass}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      allow_admin_bypass: event.target.checked,
                    }))
                  }
                />
                Admin tetap bisa akses halaman target (bypass)
              </label>
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closeForm} disabled={saving}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={submitForm} disabled={saving}>
                {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Rule' : 'Update Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={() => setDeleteTarget(null)}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(520px, 95vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <h3>Hapus Rule Maintenance</h3>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setDeleteTarget(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ ...MODAL_BODY_STYLE, fontSize: 13 }}>
              Rule <strong>{deleteTarget.name}</strong> akan dihapus permanen.
            </div>
            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={() => setDeleteTarget(null)}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={confirmDelete} disabled={saving}>
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
