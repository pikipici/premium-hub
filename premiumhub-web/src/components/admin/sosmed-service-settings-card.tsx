"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { productCategoryService } from '@/services/productCategoryService'
import {
  sosmedService,
  type AdminJAPBalance,
  type AdminSosmedImportJAPPreviewResult,
  type AdminSosmedResellerRepricePayload,
  type AdminSosmedServicePayload,
  type AdminSosmedServiceUpdatePayload,
} from '@/services/sosmedService'
import type { ProductCategory } from '@/types/productCategory'
import type { SosmedService } from '@/types/sosmedService'

type FormMode = 'create' | 'edit'
type ResellerFXMode = 'fixed' | 'live'

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
  checkout_price: string
  trust_badges_text: string
  sort_order: string
  is_active: boolean
}

type ImportJAPFormState = {
  service_ids_text: string
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

function parseJAPServiceIds(value: string) {
  return [...new Set(
    value
      .split(/[\s,]+/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0)
  )]
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatJAPBalance(value: AdminJAPBalance | null) {
  if (!value) return '-'

  const currency = value.currency?.trim() || 'USD'
  const rawBalance = value.balance?.trim() || '0'
  const parsed = Number(rawBalance)
  if (!Number.isFinite(parsed)) {
    return `${currency} ${rawBalance}`
  }

  return `${currency} ${parsed.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  })}`
}

function formatProviderRate(raw?: string) {
  const value = raw?.trim()
  if (!value) return '-'

  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed)) return value

  return parsed.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  })
}

function formatAdminTimestamp(value: Date | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function extractIDRAmount(raw?: string) {
  if (!raw) return null

  const match = raw.match(/rp\s*([0-9][0-9.]*)/i)
  if (!match || !match[1]) return null

  const normalized = match[1].replace(/\./g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function formatCompactList(items?: string[]) {
  return items?.filter(Boolean).join(', ') || '-'
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
    checkout_price: '0',
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
  const [japBalance, setJAPBalance] = useState<AdminJAPBalance | null>(null)
  const [japBalanceLoading, setJAPBalanceLoading] = useState(false)
  const [japBalanceError, setJAPBalanceError] = useState('')
  const [japBalanceFetchedAt, setJAPBalanceFetchedAt] = useState<Date | null>(null)
  const [syncingJAPMetadata, setSyncingJAPMetadata] = useState(false)

  const [resellerFXMode, setResellerFXMode] = useState<ResellerFXMode>('live')
  const [resellerFXRate, setResellerFXRate] = useState('17000')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingItem, setEditingItem] = useState<SosmedService | null>(null)
  const [form, setForm] = useState<SosmedServiceFormState>(() => createEmptyForm(''))

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<SosmedService | null>(null)
  const [detailTarget, setDetailTarget] = useState<SosmedService | null>(null)
  const [importJAPOpen, setImportJAPOpen] = useState(false)
  const [importJAPForm, setImportJAPForm] = useState<ImportJAPFormState>({ service_ids_text: '' })
  const [importJAPPreview, setImportJAPPreview] = useState<AdminSosmedImportJAPPreviewResult | null>(null)
  const [previewingJAP, setPreviewingJAP] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [activePlatformFilter, setActivePlatformFilter] = useState('All')

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

  const platformFilterOptions = useMemo(() => {
    const platforms = new Set<string>()
    items.forEach(item => {
      if (item.platform_label) platforms.add(item.platform_label)
    })
    return ['All', ...Array.from(platforms).sort()]
  }, [items])

  const sortedItems = useMemo(
    () => {
      let result = [...items]
      if (activePlatformFilter !== 'All') {
        result = result.filter(item => item.platform_label === activePlatformFilter)
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        result = result.filter(item => 
          (item.title || '').toLowerCase().includes(q) ||
          (item.code || '').toLowerCase().includes(q) ||
          (item.platform_label || '').toLowerCase().includes(q)
        )
      }
      return result.sort((left, right) => {
        const leftSort = left.sort_order ?? 100
        const rightSort = right.sort_order ?? 100
        if (leftSort !== rightSort) return leftSort - rightSort
        return (left.code || '').localeCompare(right.code || '')
      })
    },
    [items, activePlatformFilter, searchQuery]
  )

  const importJAPServiceIds = useMemo(
    () => parseJAPServiceIds(importJAPForm.service_ids_text),
    [importJAPForm.service_ids_text]
  )

  const unsupportedJAPPreviewItems = useMemo(
    () => (importJAPPreview?.items || []).filter((item) => !item.supported_for_initial_order),
    [importJAPPreview]
  )

  const canImportJAPPreview =
    !!importJAPPreview &&
    importJAPPreview.matched > 0 &&
    (importJAPPreview.not_found || []).length === 0 &&
    unsupportedJAPPreviewItems.length === 0

  const loadJAPBalance = useCallback(async () => {
    setJAPBalanceLoading(true)
    setJAPBalanceError('')

    try {
      const res = await sosmedService.adminGetJAPBalance()
      if (!res.success || !res.data) {
        setJAPBalance(null)
        setJAPBalanceError(res.message || 'Gagal memuat saldo JAP')
        return
      }

      setJAPBalance(res.data)
      setJAPBalanceFetchedAt(new Date())
    } catch (err) {
      setJAPBalance(null)
      setJAPBalanceError(mapErrorMessage(err, 'Gagal memuat saldo JAP'))
    } finally {
      setJAPBalanceLoading(false)
    }
  }, [])

  const syncJAPMetadata = async () => {
    setSyncingJAPMetadata(true)
    setError('')
    try {
      const res = await sosmedService.adminSyncJAPMetadata()
      if (!res.success) {
        setError(res.message || 'Gagal sinkronisasi metadata JAP')
        return
      }
      setNotice(`Berhasil menarik ${res.data.updated} metadata JAP terbaru.`)
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal sinkronisasi metadata JAP'))
    } finally {
      setSyncingJAPMetadata(false)
    }
  }

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
    void loadJAPBalance()
  }, [loadJAPBalance])

  useEffect(() => {
    if (!formOpen && !confirmOpen && !detailTarget && !importJAPOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [confirmOpen, detailTarget, formOpen, importJAPOpen])

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
      checkout_price: String(item.checkout_price ?? 0),
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

  const openImportJAPForm = () => {
    setImportJAPForm({ service_ids_text: '' })
    setImportJAPPreview(null)
    setError('')
    setImportJAPOpen(true)
  }

  const closeImportJAPForm = () => {
    if (saving || previewingJAP) return
    setImportJAPOpen(false)
    setImportJAPForm({ service_ids_text: '' })
    setImportJAPPreview(null)
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
    const checkoutPrice = Math.max(0, Number(form.checkout_price) || 0)
    if (checkoutPrice <= 0) {
      setError('Checkout price wajib lebih dari 0')
      return
    }
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
      checkout_price: checkoutPrice,
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
          checkout_price: payloadBase.checkout_price,
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

  const repriceResellerToIDR = async () => {
    setSaving(true)
    setError('')

    try {
      const payload: AdminSosmedResellerRepricePayload = {
        mode: resellerFXMode,
        include_inactive: true,
        provider_code: 'jap',
        code_prefix: 'jap-',
      }

      if (resellerFXMode === 'fixed') {
        const fixedRate = Number(resellerFXRate)
        if (!Number.isFinite(fixedRate) || fixedRate <= 0) {
          setError('Kurs fixed wajib angka valid (> 0)')
          return
        }
        payload.fixed_rate = fixedRate
      }

      const res = await sosmedService.adminRepriceReseller(payload)
      if (!res.success) {
        setError(res.message || 'Gagal sinkronisasi harga reseller')
        return
      }

      const data = res.data
      const rateLabel = Number.isFinite(data.rate_used)
        ? data.rate_used.toLocaleString('id-ID', { maximumFractionDigits: 2 })
        : String(data.rate_used)

      const warningText = data.warning ? ` • ${data.warning}` : ''
      setNotice(
        `Sync reseller selesai (${data.mode}/${data.rate_source}). Kurs ${rateLabel}. Update ${data.updated}/${data.eligible}.${warningText}`
      )

      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal sinkronisasi harga reseller'))
    } finally {
      setSaving(false)
    }
  }

  const importSelectedJAPServices = async () => {
    const serviceIds = importJAPServiceIds
    if (serviceIds.length === 0) {
      setError('Masukin minimal satu service ID JAP yang valid')
      return
    }
    if (!canImportJAPPreview) {
      setError('Preview dulu sampai semua service ketemu dan support order awal.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await sosmedService.adminImportJAPSelected({ service_ids: serviceIds })
      if (!res.success) {
        setError(res.message || 'Gagal import layanan JAP')
        return
      }

      const data = res.data
      const importedTitles = (data.items || [])
        .slice(0, 3)
        .map((item) => item.title)
        .filter(Boolean)
        .join(', ')

      const importedSuffix = importedTitles ? ` • ${importedTitles}` : ''
      const warningSuffix = data.warning ? ` • ${data.warning}` : ''
      const notFoundSuffix = data.not_found?.length ? ` • Tidak ketemu: ${data.not_found.join(', ')}` : ''

      setNotice(
        `Import JAP selesai. Dibuat ${data.created}, diperbarui ${data.updated}, dilewati ${data.skipped}.${importedSuffix}${warningSuffix}${notFoundSuffix}`
      )
      closeImportJAPForm()
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal import layanan JAP'))
    } finally {
      setSaving(false)
    }
  }

  const previewSelectedJAPServices = async () => {
    if (importJAPServiceIds.length === 0) {
      setError('Masukin minimal satu service ID JAP yang valid')
      return
    }

    setPreviewingJAP(true)
    setImportJAPPreview(null)
    setError('')

    try {
      const res = await sosmedService.adminPreviewJAPSelected({ service_ids: importJAPServiceIds })
      if (!res.success) {
        setError(res.message || 'Gagal preview layanan JAP')
        return
      }

      setImportJAPPreview(res.data)
      const notFoundSuffix = res.data.not_found?.length ? ` • Tidak ketemu: ${res.data.not_found.join(', ')}` : ''
      const unsupportedSuffix = res.data.items.some((item) => !item.supported_for_initial_order)
        ? ' • Ada tipe yang belum support order awal'
        : ''
      setNotice(`Preview JAP selesai. Ketemu ${res.data.matched}/${res.data.requested}.${notFoundSuffix}${unsupportedSuffix}`)
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal preview layanan JAP'))
    } finally {
      setPreviewingJAP(false)
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Saldo JustAnotherPanel</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Saldo supplier live buat order sosmed yang dikirim ke JAP.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="action-btn"
              type="button"
              disabled={syncingJAPMetadata}
              onClick={() => void syncJAPMetadata()}
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {syncingJAPMetadata ? 'Menarik...' : 'Tarik Harga JAP'}
            </button>
            <button
              className="action-btn"
              type="button"
              disabled={japBalanceLoading}
              onClick={() => void loadJAPBalance()}
            >
              {japBalanceLoading ? 'Memuat...' : 'Refresh Saldo'}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 18px 18px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                borderRadius: 14,
                padding: 18,
                background: '#141414',
                color: '#fff',
                minHeight: 112,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Supplier Balance
                  </div>
                  <div style={{ marginTop: 8, fontSize: 30, fontWeight: 900, letterSpacing: -0.6 }}>
                    {japBalanceLoading && !japBalance ? 'Mengambil...' : formatJAPBalance(japBalance)}
                  </div>
                </div>
                <span
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: 999,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontWeight: 800,
                    background: japBalanceError ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.14)',
                    color: japBalanceError ? '#fecaca' : '#bbf7d0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {japBalanceError ? 'Perlu Cek' : 'Live'}
                </span>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.64)' }}>
                Terakhir update: {formatAdminTimestamp(japBalanceFetchedAt)}
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--line, #E5E7EB)',
                borderRadius: 14,
                padding: 16,
                background: japBalanceError ? '#fff7ed' : '#f8fafc',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Status Koneksi
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: 800,
                  color: japBalanceError ? '#9a3412' : '#166534',
                }}
              >
                {japBalanceError ? 'Gagal ambil saldo' : 'JAP tersambung'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
                {japBalanceError || 'Key dan endpoint JAP kebaca. Saldo ini read-only, aman buat dicek kapan aja.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <h2>Master Layanan Sosmed</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Konten card di /product/sosmed diambil langsung dari master layanan ini.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ minWidth: 120 }}
                value={resellerFXMode}
                onChange={(event) => setResellerFXMode(event.target.value as ResellerFXMode)}
                disabled={saving || loading}
              >
                <option value="live">Kurs Live</option>
                <option value="fixed">Kurs Fixed</option>
              </select>

              {resellerFXMode === 'fixed' && (
                <input
                  className="form-input"
                  style={{ width: 130 }}
                  value={resellerFXRate}
                  onChange={(event) => setResellerFXRate(event.target.value)}
                  placeholder="17000"
                  disabled={saving || loading}
                />
              )}

              <button
                className="topbar-btn"
                type="button"
                onClick={repriceResellerToIDR}
                disabled={saving || loading}
              >
                Sync Reseller → Rupiah
              </button>
            </div>

            <button className="topbar-btn primary" type="button" onClick={openCreateForm} disabled={saving}>
              + Tambah Layanan
            </button>
            <button className="topbar-btn" type="button" onClick={openImportJAPForm} disabled={saving || loading}>
              Import JAP Pilihan
            </button>
          </div>
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: 220 }}
              placeholder="Cari nama/kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: 180 }}
              value={activePlatformFilter}
              onChange={(e) => setActivePlatformFilter(e.target.value)}
            >
              {platformFilterOptions.map(p => (
                <option key={p} value={p}>{p === 'All' ? 'Semua Platform' : p}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat layanan sosmed...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Tidak ada layanan sosmed yang sesuai pencarian.</div>
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
                    <th style={{ width: 260 }}>Aksi</th>
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
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.price_start || `Rp ${(item.checkout_price || 0).toLocaleString('id-ID')}/1K`}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Checkout: Rp {(item.checkout_price || 0).toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td>{item.sort_order ?? 100}</td>
                        <td>
                          <span className={`status ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" type="button" onClick={() => setDetailTarget(item)}>
                              Detail
                            </button>
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

      {importJAPOpen && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeImportJAPForm}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(920px, 96vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>Import Layanan JAP Pilihan</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>
                  Masukin ID JAP, preview audit dulu, lalu import service yang support order awal.
                </div>
              </div>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeImportJAPForm}>×</button>
            </div>

            <div className="modal-body" style={MODAL_BODY_STYLE}>
              <div>
                <label className="form-label">Service IDs JAP</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={importJAPForm.service_ids_text}
                  onChange={(event) => {
                    setImportJAPPreview(null)
                    setImportJAPForm((prev) => ({ ...prev, service_ids_text: event.target.value }))
                  }}
                  placeholder="Contoh: 6331, 10242, 8695"
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Preview ngecek nama lokal, kategori, tipe order JAP, field wajib, harga reseller, dan apakah service aman buat jalur order awal.
              </div>

              {importJAPPreview && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                    <span className="status s-lunas">Ketemu {importJAPPreview.matched}/{importJAPPreview.requested}</span>
                    <span className="status s-lunas">
                      Kurs {importJAPPreview.rate_used.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </span>
                    {unsupportedJAPPreviewItems.length > 0 && (
                      <span className="status s-gagal">Belum support: {unsupportedJAPPreviewItems.length}</span>
                    )}
                    {(importJAPPreview.not_found || []).length > 0 && (
                      <span className="status s-gagal">Tidak ketemu: {importJAPPreview.not_found.join(', ')}</span>
                    )}
                  </div>

                  <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--line, #E5E7EB)', borderRadius: 10 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>JAP ID</th>
                          <th>Draft Lokal</th>
                          <th>Tipe Order</th>
                          <th>Harga Reseller</th>
                          <th>Field Wajib</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importJAPPreview.items.map((item) => (
                          <tr key={item.service_id}>
                            <td>
                              <code>{item.service_id}</code>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.local_title}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                <code>{item.local_code}</code>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {item.platform_label} • {item.local_category_code}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.provider_type || '-'}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.fulfillment_mode}</div>
                              {item.existing_code && (
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  Existing: <code>{item.existing_code}</code>
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.price_start || '-'}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Min {item.min || '-'} • Max {item.max || '-'}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: 12 }}>{formatCompactList(item.required_order_fields)}</div>
                              {item.optional_order_fields?.length > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  Opsional: {formatCompactList(item.optional_order_fields)}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`status ${item.supported_for_initial_order ? 's-lunas' : 's-gagal'}`}>
                                {item.supported_for_initial_order ? 'Siap Awal' : 'Review Manual'}
                              </span>
                              {item.warnings?.length > 0 && (
                                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                                  {item.warnings.join(' ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closeImportJAPForm} disabled={saving || previewingJAP}>
                Batal
              </button>
              <button className="topbar-btn" type="button" onClick={previewSelectedJAPServices} disabled={saving || previewingJAP}>
                {previewingJAP ? 'Preview...' : 'Preview Audit'}
              </button>
              <button
                className="topbar-btn primary"
                type="button"
                onClick={importSelectedJAPServices}
                disabled={saving || previewingJAP || !canImportJAPPreview}
              >
                {saving ? 'Mengimpor...' : 'Import Draft JAP'}
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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
                <div>
                  <label className="form-label">Checkout Price (IDR)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={form.checkout_price}
                    onChange={(event) => setForm((prev) => ({ ...prev, checkout_price: event.target.value }))}
                    placeholder="28000"
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

      {detailTarget && (() => {
        const resellerPer1K = extractIDRAmount(detailTarget.price_per_1k || detailTarget.price_start)
        const checkoutPrice = detailTarget.checkout_price || 0
        const spread = resellerPer1K !== null && checkoutPrice > 0
          ? checkoutPrice - resellerPer1K
          : null
        const supplierCurrency = detailTarget.provider_currency?.trim() || 'USD'
        const supplierRate = detailTarget.provider_rate?.trim()
        const detailStatus = statusLabel(detailTarget)

        return (
          <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={() => setDetailTarget(null)}>
            <div
              className="modal-card"
              style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(880px, 96vw)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head" style={MODAL_HEAD_STYLE}>
                <div>
                  <h3>Detail Layanan Sosmed</h3>
                  <div className="modal-sub" style={MODAL_SUB_STYLE}>{detailTarget.code}</div>
                </div>
                <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setDetailTarget(null)}>×</button>
              </div>

              <div className="modal-body" style={MODAL_BODY_STYLE}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Layanan</div>
                    <div style={{ fontWeight: 700 }}>{detailTarget.title || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {(categoryLabelMap[detailTarget.category_code] || detailTarget.category_code || '-')}
                      {' • '}
                      {detailTarget.platform_label || '-'}
                      {' • '}
                      {detailTarget.badge_text || '-'}
                    </div>
                    {detailTarget.provider_title && detailTarget.provider_title.trim() && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Nama Asli Provider</div>
                        <div
                          style={{
                            fontSize: 12,
                            border: '1px solid var(--line, #E5E7EB)',
                            borderRadius: 8,
                            padding: '6px 8px',
                            background: '#fff',
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                          }}
                        >
                          {detailTarget.provider_title}
                        </div>
                      </div>
                    )}
                    {(detailTarget.provider_code || detailTarget.provider_service_id || detailTarget.provider_rate) && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Metadata Provider</div>
                        <div
                          style={{
                            fontSize: 12,
                            border: '1px solid var(--line, #E5E7EB)',
                            borderRadius: 8,
                            padding: '6px 8px',
                            background: '#fff',
                            lineHeight: 1.5,
                          }}
                        >
                          <div>
                            {(detailTarget.provider_code || '-').toUpperCase()}
                            {detailTarget.provider_service_id ? ` #${detailTarget.provider_service_id}` : ''}
                            {detailTarget.provider_type ? ` • ${detailTarget.provider_type}` : ''}
                          </div>
                          <div style={{ color: 'var(--muted)' }}>
                            {detailTarget.provider_category || '-'}
                            {detailTarget.provider_rate ? ` • ${detailTarget.provider_currency || 'USD'} ${detailTarget.provider_rate}` : ''}
                          </div>
                          <div style={{ color: 'var(--muted)' }}>
                            Refill: {detailTarget.provider_refill_supported ? 'Ya' : 'Tidak'}
                            {' • '}
                            Cancel: {detailTarget.provider_cancel_supported ? 'Ya' : 'Tidak'}
                            {' • '}
                            Dripfeed: {detailTarget.provider_dripfeed_supported ? 'Ya' : 'Tidak'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Status & Urutan</div>
                    <div>
                      <span className={`status ${detailStatus.className}`}>{detailStatus.label}</span>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Sort order: <strong>{detailTarget.sort_order ?? 100}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
                  <div className="card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Min Order</div>
                    <div style={{ fontWeight: 600 }}>{detailTarget.min_order || '-'}</div>
                  </div>
                  <div className="card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Start Time</div>
                    <div style={{ fontWeight: 600 }}>{detailTarget.start_time || '-'}</div>
                  </div>
                  <div className="card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Refill</div>
                    <div style={{ fontWeight: 600 }}>{detailTarget.refill || '-'}</div>
                  </div>
                  <div className="card" style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>ETA</div>
                    <div style={{ fontWeight: 600 }}>{detailTarget.eta || '-'}</div>
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: 12,
                    borderColor: '#FED7AA',
                    background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 72%)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Harga & Margin JAP</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)' }}>
                        Ringkasan modal supplier, harga jual, dan profit estimasi per 1K.
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Basis hitung: 1 paket = 1.000 unit
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <div className="card" style={{ padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Harga JAP Supplier</div>
                      <div style={{ marginTop: 3, fontWeight: 800 }}>
                        {supplierRate ? `${supplierCurrency} ${formatProviderRate(supplierRate)}` : '-'}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>per 1K dari provider</div>
                    </div>

                    <div className="card" style={{ padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Estimasi Modal Rupiah</div>
                      <div style={{ marginTop: 3, fontWeight: 800 }}>
                        {resellerPer1K === null ? '-' : formatRupiah(resellerPer1K)}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                        {detailTarget.price_per_1k || detailTarget.price_start || 'per 1K setelah kurs'}
                      </div>
                    </div>

                    <div className="card" style={{ padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Harga Jual Checkout</div>
                      <div style={{ marginTop: 3, fontWeight: 800 }}>{checkoutPrice > 0 ? formatRupiah(checkoutPrice) : '-'}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>per 1K dibayar user</div>
                    </div>

                    <div className="card" style={{ padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Estimasi Profit</div>
                      <div
                        style={{
                          marginTop: 3,
                          fontWeight: 900,
                          color:
                            spread === null
                              ? 'var(--muted)'
                              : spread >= 0
                                ? 'var(--green, #047857)'
                                : 'var(--red, #DC2626)',
                        }}
                      >
                        {spread === null ? '-' : `${spread >= 0 ? '+' : '-'}${formatRupiah(Math.abs(spread))}`}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>per 1K setelah modal</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Summary</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{detailTarget.summary || '-'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Trust Badges</div>
                  {!!detailTarget.trust_badges?.length ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {detailTarget.trust_badges.map((badge) => (
                        <span
                          key={`${detailTarget.id}-${badge}`}
                          style={{
                            fontSize: 11,
                            border: '1px solid var(--line, #E5E7EB)',
                            borderRadius: 999,
                            padding: '3px 10px',
                            color: 'var(--muted)',
                            background: '#fff',
                          }}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>-</div>
                  )}
                </div>
              </div>

              <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
                <button className="action-btn" type="button" onClick={() => setDetailTarget(null)}>
                  Tutup
                </button>
                <button
                  className="topbar-btn primary"
                  type="button"
                  onClick={() => {
                    setDetailTarget(null)
                    openEditForm(detailTarget)
                  }}
                >
                  Edit Layanan
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
