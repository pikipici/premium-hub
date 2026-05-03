"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildAdminSosmedCatalogTabs,
  type AdminSosmedCatalogTabKey,
} from '@/lib/adminSosmedCatalogTabs'
import { buildAdminSosmedBundleRows, getAdminSosmedBundleSummary } from '@/lib/adminSosmedBundles'
import {
  buildBundleServiceOptions,
  buildCreateItemPayload,
  buildCreatePackagePayload,
  buildCreateVariantPayload,
  buildUpdateItemPayload,
  buildUpdatePackagePayload,
  buildUpdateVariantPayload,
  createEmptyItemForm,
  createEmptyPackageForm,
  createEmptyVariantForm,
  createItemFormFromItem,
  createPackageFormFromBundle,
  createVariantFormFromVariant,
  getBundleMutationNotice,
  getItemModalCopy,
  getItemStatusToggle,
  getPackageDetailSummary,
  getPackageModalCopy,
  getPackageStatusToggle,
  getVariantModalCopy,
  getVariantPriceFieldVisibility,
  getVariantStatusToggle,
  type AdminSosmedBundleItemForm,
  type AdminSosmedBundleItemFormMode,
  type AdminSosmedBundlePackageForm,
  type AdminSosmedBundlePackageFormMode,
  type AdminSosmedBundleVariantForm,
  type AdminSosmedBundleVariantFormMode,
} from '@/lib/adminSosmedBundleEditor'
import { productCategoryService } from '@/services/productCategoryService'
import { sosmedBundleService } from '@/services/sosmedBundleService'
import {
  sosmedService,
  type AdminJAPBalance,
  type AdminSosmedImportJAPPreviewResult,
  type AdminSosmedResellerRepricePayload,
  type AdminSosmedServicePayload,
  type AdminSosmedServiceUpdatePayload,
} from '@/services/sosmedService'

import type { ProductCategory } from '@/types/productCategory'
import type {
  AdminSosmedBundleItem,
  AdminSosmedBundlePackage,
  AdminSosmedBundleVariant,
} from '@/types/sosmedBundle'
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

function bundleStatusClass(label: string) {
  if (label === 'Aktif' || label === 'Highlight') return 's-lunas'
  if (label === 'Ada Item Nonaktif') return 's-proses'
  return 's-gagal'
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
  const [bundlePackages, setBundlePackages] = useState<AdminSosmedBundlePackage[]>([])
  const [activeCatalogTab, setActiveCatalogTab] = useState<AdminSosmedCatalogTabKey>('single')
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

  const [packageFormOpen, setPackageFormOpen] = useState(false)
  const [packageFormMode, setPackageFormMode] = useState<AdminSosmedBundlePackageFormMode>('create')
  const [editingBundlePackage, setEditingBundlePackage] = useState<AdminSosmedBundlePackage | null>(null)
  const [packageForm, setPackageForm] = useState<AdminSosmedBundlePackageForm>(() => createEmptyPackageForm())
  const [packageDetailTarget, setPackageDetailTarget] = useState<AdminSosmedBundlePackage | null>(null)

  const [variantManagerPackage, setVariantManagerPackage] = useState<AdminSosmedBundlePackage | null>(null)
  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [variantFormMode, setVariantFormMode] = useState<AdminSosmedBundleVariantFormMode>('create')
  const [editingBundleVariant, setEditingBundleVariant] = useState<AdminSosmedBundleVariant | null>(null)
  const [variantForm, setVariantForm] = useState<AdminSosmedBundleVariantForm>(() => createEmptyVariantForm(''))

  const [itemManagerVariant, setItemManagerVariant] = useState<AdminSosmedBundleVariant | null>(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [itemFormMode, setItemFormMode] = useState<AdminSosmedBundleItemFormMode>('create')
  const [editingBundleItem, setEditingBundleItem] = useState<AdminSosmedBundleItem | null>(null)
  const [itemForm, setItemForm] = useState<AdminSosmedBundleItemForm>(() => createEmptyItemForm(''))

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

  const bundleRows = useMemo(() => buildAdminSosmedBundleRows(bundlePackages), [bundlePackages])

  const bundleSummary = useMemo(() => getAdminSosmedBundleSummary(bundlePackages), [bundlePackages])

  const bundlePackageByKey = useMemo(
    () => new Map(bundlePackages.map((bundle) => [bundle.key, bundle])),
    [bundlePackages]
  )

  const packageModalCopy = useMemo(
    () => getPackageModalCopy(packageFormMode, editingBundlePackage || undefined),
    [editingBundlePackage, packageFormMode]
  )

  const variantManagerPackageCurrent = useMemo(() => {
    if (!variantManagerPackage) return null
    return bundlePackages.find((bundle) => bundle.id === variantManagerPackage.id) || variantManagerPackage
  }, [bundlePackages, variantManagerPackage])

  const itemManagerVariantCurrent = useMemo(() => {
    if (!itemManagerVariant) return null
    const latestVariant = variantManagerPackageCurrent?.variants?.find((variant) => variant.id === itemManagerVariant.id)
    return latestVariant || itemManagerVariant
  }, [itemManagerVariant, variantManagerPackageCurrent])

  const bundleServiceOptions = useMemo(() => buildBundleServiceOptions(items), [items])

  const variantModalCopy = useMemo(
    () => variantManagerPackageCurrent
      ? getVariantModalCopy(variantFormMode, variantManagerPackageCurrent, editingBundleVariant || undefined)
      : null,
    [editingBundleVariant, variantFormMode, variantManagerPackageCurrent]
  )

  const itemModalCopy = useMemo(
    () => itemManagerVariantCurrent
      ? getItemModalCopy(itemFormMode, itemManagerVariantCurrent, editingBundleItem || undefined)
      : null,
    [editingBundleItem, itemFormMode, itemManagerVariantCurrent]
  )

  const variantPriceFieldVisibility = useMemo(
    () => getVariantPriceFieldVisibility(variantForm.price_mode),
    [variantForm.price_mode]
  )

  const catalogTabs = useMemo(
    () => buildAdminSosmedCatalogTabs({
      activeTab: activeCatalogTab,
      singleServiceCount: items.length,
      bundleVariantCount: bundleRows.length,
    }),
    [activeCatalogTab, bundleRows.length, items.length]
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
      const [serviceRes, categoryRes, bundleRes] = await Promise.all([
        sosmedService.adminList({ include_inactive: true }),
        productCategoryService.adminList({ scope: 'sosmed', include_inactive: true }),
        sosmedBundleService.adminList({ include_inactive: true }),
      ])

      if (!serviceRes.success) {
        setError(serviceRes.message || 'Gagal memuat layanan sosmed')
        return
      }
      if (!categoryRes.success) {
        setError(categoryRes.message || 'Gagal memuat kategori sosmed')
        return
      }
      if (!bundleRes.success) {
        setError(bundleRes.message || 'Gagal memuat paket spesial sosmed')
        return
      }

      setItems(serviceRes.data || [])
      setCategories(categoryRes.data || [])
      setBundlePackages(bundleRes.data || [])
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
    if (!formOpen && !confirmOpen && !detailTarget && !importJAPOpen && !packageFormOpen && !packageDetailTarget && !variantManagerPackage) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [confirmOpen, detailTarget, formOpen, importJAPOpen, packageDetailTarget, packageFormOpen, variantManagerPackage])

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

  const openCreatePackageForm = () => {
    setPackageFormMode('create')
    setEditingBundlePackage(null)
    setPackageForm(createEmptyPackageForm())
    setActiveCatalogTab('bundle')
    setError('')
    setPackageFormOpen(true)
  }

  const openEditPackageForm = (bundle: AdminSosmedBundlePackage) => {
    setPackageFormMode('edit')
    setEditingBundlePackage(bundle)
    setPackageForm(createPackageFormFromBundle(bundle))
    setActiveCatalogTab('bundle')
    setError('')
    setPackageFormOpen(true)
  }

  const closePackageForm = () => {
    if (saving) return
    setPackageFormOpen(false)
    setEditingBundlePackage(null)
    setPackageForm(createEmptyPackageForm())
  }

  const openPackageDetail = (bundle: AdminSosmedBundlePackage) => {
    setActiveCatalogTab('bundle')
    setPackageDetailTarget(bundle)
  }

  const submitPackageForm = async () => {
    if (packageFormMode === 'create') {
      const createPayload = buildCreatePackagePayload(packageForm)
      if (!createPayload.key) {
        setError('Key paket wajib diisi')
        return
      }
      if (!createPayload.title) {
        setError('Judul paket wajib diisi')
        return
      }
      if (!createPayload.platform) {
        setError('Platform paket wajib diisi')
        return
      }

      setSaving(true)
      setError('')

      try {
        const res = await sosmedBundleService.adminCreatePackage(createPayload)
        if (!res.success) {
          setError(res.message || 'Gagal membuat paket spesial')
          return
        }

        setNotice(getBundleMutationNotice('create', 'package'))
        closePackageForm()
        setActiveCatalogTab('bundle')
        await loadData()
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal menyimpan paket spesial'))
      } finally {
        setSaving(false)
      }
      return
    }

    if (!editingBundlePackage) {
      setError('Paket yang diedit belum dipilih')
      return
    }

    const updatePayload = buildUpdatePackagePayload(packageForm)
    if (!updatePayload.title) {
      setError('Judul paket wajib diisi')
      return
    }
    if (!updatePayload.platform) {
      setError('Platform paket wajib diisi')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdatePackage(editingBundlePackage.id, updatePayload)
      if (!res.success) {
        setError(res.message || 'Gagal memperbarui paket spesial')
        return
      }

      setNotice(getBundleMutationNotice('update', 'package'))
      closePackageForm()
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan paket spesial'))
    } finally {
      setSaving(false)
    }
  }

  const togglePackageActive = async (bundle: AdminSosmedBundlePackage) => {
    const toggle = getPackageStatusToggle(bundle)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdatePackage(bundle.id, toggle.payload)
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status paket spesial')
        return
      }

      setNotice(toggle.notice)
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status paket spesial'))
    } finally {
      setSaving(false)
    }
  }

  const openVariantManager = (bundle: AdminSosmedBundlePackage) => {
    setActiveCatalogTab('bundle')
    setPackageDetailTarget(null)
    setVariantManagerPackage(bundle)
    setVariantFormOpen(false)
    setVariantFormMode('create')
    setEditingBundleVariant(null)
    setVariantForm(createEmptyVariantForm(bundle.id))
    setItemManagerVariant(null)
    setItemFormOpen(false)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(''))
    setError('')
  }

  const closeVariantManager = () => {
    if (saving) return
    setVariantManagerPackage(null)
    setVariantFormOpen(false)
    setVariantFormMode('create')
    setEditingBundleVariant(null)
    setVariantForm(createEmptyVariantForm(''))
    setItemManagerVariant(null)
    setItemFormOpen(false)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(''))
  }

  const openCreateVariantForm = (bundle: AdminSosmedBundlePackage) => {
    setVariantManagerPackage(bundle)
    setVariantFormMode('create')
    setEditingBundleVariant(null)
    setVariantForm(createEmptyVariantForm(bundle.id))
    setVariantFormOpen(true)
    setError('')
  }

  const openEditVariantForm = (bundle: AdminSosmedBundlePackage, variant: AdminSosmedBundleVariant) => {
    setVariantManagerPackage(bundle)
    setVariantFormMode('edit')
    setEditingBundleVariant(variant)
    setVariantForm(createVariantFormFromVariant(bundle.id, variant))
    setVariantFormOpen(true)
    setError('')
  }

  const closeVariantForm = () => {
    if (saving) return
    setVariantFormOpen(false)
    setVariantFormMode('create')
    setEditingBundleVariant(null)
    setVariantForm(createEmptyVariantForm(variantManagerPackageCurrent?.id || ''))
  }

  const submitVariantForm = async () => {
    const targetPackage = variantManagerPackageCurrent
    if (!targetPackage) {
      setError('Paket untuk variant belum dipilih')
      return
    }

    if (variantFormMode === 'create') {
      const createPayload = buildCreateVariantPayload(variantForm)
      if (!createPayload.key) {
        setError('Key variant wajib diisi')
        return
      }
      if (!createPayload.name) {
        setError('Nama variant wajib diisi')
        return
      }
      if (createPayload.price_mode === 'fixed' && (createPayload.fixed_price || 0) <= 0) {
        setError('Fixed price wajib lebih dari 0 untuk mode fixed')
        return
      }

      setSaving(true)
      setError('')

      try {
        const res = await sosmedBundleService.adminCreateVariant(targetPackage.id, createPayload)
        if (!res.success) {
          setError(res.message || 'Gagal membuat variant paket')
          return
        }

        setNotice(getBundleMutationNotice('create', 'variant'))
        setVariantFormOpen(false)
        setVariantForm(createEmptyVariantForm(targetPackage.id))
        setActiveCatalogTab('bundle')
        await loadData()
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal menyimpan variant paket'))
      } finally {
        setSaving(false)
      }
      return
    }

    if (!editingBundleVariant) {
      setError('Variant yang diedit belum dipilih')
      return
    }

    const updatePayload = buildUpdateVariantPayload(variantForm)
    if (!updatePayload.name) {
      setError('Nama variant wajib diisi')
      return
    }
    if (updatePayload.price_mode === 'fixed' && (updatePayload.fixed_price || 0) <= 0) {
      setError('Fixed price wajib lebih dari 0 untuk mode fixed')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdateVariant(editingBundleVariant.id, updatePayload)
      if (!res.success) {
        setError(res.message || 'Gagal memperbarui variant paket')
        return
      }

      setNotice(getBundleMutationNotice('update', 'variant'))
      setVariantFormOpen(false)
      setVariantForm(createEmptyVariantForm(targetPackage.id))
      setVariantFormMode('create')
      setEditingBundleVariant(null)
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan variant paket'))
    } finally {
      setSaving(false)
    }
  }

  const toggleVariantActive = async (variant: AdminSosmedBundleVariant) => {
    const toggle = getVariantStatusToggle(variant)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdateVariant(variant.id, toggle.payload)
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status variant paket')
        return
      }

      setNotice(toggle.notice)
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status variant paket'))
    } finally {
      setSaving(false)
    }
  }

  const openItemManager = (variant: AdminSosmedBundleVariant) => {
    setItemManagerVariant(variant)
    setItemFormOpen(false)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(variant.id))
    setError('')
  }

  const closeItemManager = () => {
    if (saving) return
    setItemManagerVariant(null)
    setItemFormOpen(false)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(''))
  }

  const openCreateItemForm = (variant: AdminSosmedBundleVariant) => {
    setItemManagerVariant(variant)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(variant.id))
    setItemFormOpen(true)
    setError('')
  }

  const openEditItemForm = (variant: AdminSosmedBundleVariant, item: AdminSosmedBundleItem) => {
    setItemManagerVariant(variant)
    setItemFormMode('edit')
    setEditingBundleItem(item)
    setItemForm(createItemFormFromItem(variant.id, item))
    setItemFormOpen(true)
    setError('')
  }

  const closeItemForm = () => {
    if (saving) return
    setItemFormOpen(false)
    setItemFormMode('create')
    setEditingBundleItem(null)
    setItemForm(createEmptyItemForm(itemManagerVariantCurrent?.id || ''))
  }

  const submitItemForm = async () => {
    const targetVariant = itemManagerVariantCurrent
    if (!targetVariant) {
      setError('Variant untuk item belum dipilih')
      return
    }

    if (itemFormMode === 'create') {
      const createPayload = buildCreateItemPayload(itemForm)
      if (!createPayload.sosmed_service_id) {
        setError('Layanan sosmed wajib dipilih')
        return
      }
      if ((createPayload.quantity_units || 0) <= 0) {
        setError('Quantity item wajib lebih dari 0')
        return
      }

      setSaving(true)
      setError('')

      try {
        const res = await sosmedBundleService.adminCreateItem(targetVariant.id, createPayload)
        if (!res.success) {
          setError(res.message || 'Gagal membuat item bundle')
          return
        }

        setNotice(getBundleMutationNotice('create', 'item'))
        setItemFormOpen(false)
        setItemForm(createEmptyItemForm(targetVariant.id))
        setActiveCatalogTab('bundle')
        await loadData()
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal menyimpan item bundle'))
      } finally {
        setSaving(false)
      }
      return
    }

    if (!editingBundleItem) {
      setError('Item yang diedit belum dipilih')
      return
    }

    const updatePayload = buildUpdateItemPayload(itemForm)
    if (!updatePayload.sosmed_service_id) {
      setError('Layanan sosmed wajib dipilih')
      return
    }
    if ((updatePayload.quantity_units || 0) <= 0) {
      setError('Quantity item wajib lebih dari 0')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdateItem(editingBundleItem.id, updatePayload)
      if (!res.success) {
        setError(res.message || 'Gagal memperbarui item bundle')
        return
      }

      setNotice(getBundleMutationNotice('update', 'item'))
      setItemFormOpen(false)
      setItemForm(createEmptyItemForm(targetVariant.id))
      setItemFormMode('create')
      setEditingBundleItem(null)
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan item bundle'))
    } finally {
      setSaving(false)
    }
  }

  const toggleItemActive = async (item: AdminSosmedBundleItem) => {
    const toggle = getItemStatusToggle(item)
    setSaving(true)
    setError('')

    try {
      const res = await sosmedBundleService.adminUpdateItem(item.id, toggle.payload)
      if (!res.success) {
        setError(res.message || 'Gagal mengubah status item bundle')
        return
      }

      setNotice(toggle.notice)
      setActiveCatalogTab('bundle')
      await loadData()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status item bundle'))
    } finally {
      setSaving(false)
    }
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
        <div
          role="tablist"
          aria-label="Kelola katalog sosmed"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12 }}
        >
          {catalogTabs.map((tab) => (
            <button
              key={tab.key}
              id={tab.tabId}
              className={`topbar-btn${tab.isActive ? ' primary' : ''}`}
              type="button"
              role="tab"
              aria-selected={tab.isActive}
              aria-controls={tab.panelId}
              title={tab.controlsLabel}
              onClick={() => setActiveCatalogTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'space-between',
                minWidth: 190,
              }}
            >
              <span>{tab.label}</span>
              <span className={`status ${tab.isActive ? 's-lunas' : 's-proses'}`}>{tab.countLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {(error || notice) && (
        <div className="card" style={{ marginBottom: 12, padding: '12px 18px' }}>
          {error && (
            <div style={{ marginBottom: notice ? 8 : 0, fontSize: 12, color: 'var(--red)' }}>
              {error}
            </div>
          )}
          {notice && <div className="alert success">{notice}</div>}
        </div>
      )}

      {activeCatalogTab === 'single' && (
        <div id="admin-sosmed-panel-single" role="tabpanel" aria-labelledby="admin-sosmed-tab-single">
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
        </div>
      )}

      {activeCatalogTab === 'bundle' && (
        <div id="admin-sosmed-panel-bundle" role="tabpanel" aria-labelledby="admin-sosmed-tab-bundle">
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <h2>Paket Spesial</h2>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Bundle aktif/nonaktif dari admin catalog. Inactive package, variant, dan item tetap kelihatan buat audit/edit.
                </div>
              </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="status s-lunas">{bundleSummary.packageCount} Paket</span>
              <span className="status s-lunas">{bundleSummary.variantCount} Variant</span>
              <span className="status s-lunas">{bundleSummary.itemCount} Item Layanan</span>
            </div>
            <button className="topbar-btn primary" type="button" onClick={openCreatePackageForm} disabled={saving || loading}>
              + Tambah Paket
            </button>
          </div>
        </div>

        <div style={{ padding: '0 18px 18px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat paket spesial...</div>
          ) : bundleRows.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada paket spesial di admin catalog.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Paket</th>
                    <th>Variant</th>
                    <th>Platform</th>
                    <th>Harga Bundle</th>
                    <th>Isi Paket</th>
                    <th>Status</th>
                    <th style={{ width: 340 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleRows.map((bundle) => {
                    const targetPackage = bundlePackageByKey.get(bundle.packageKey)
                    const packageToggle = targetPackage ? getPackageStatusToggle(targetPackage) : null

                    return (
                      <tr key={bundle.key}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{bundle.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            <code>{bundle.packageKey}</code> • {bundle.badge}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{bundle.variantName}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            <code>{bundle.variantKey}</code>
                          </div>
                        </td>
                        <td>{bundle.platform}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{bundle.priceLabel}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{bundle.discountLabel}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{bundle.itemSummary}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {bundle.itemTitles.slice(0, 3).join(', ')}{bundle.itemTitles.length > 3 ? ` +${bundle.itemTitles.length - 3} lagi` : ''}
                          </div>
                        </td>
                        <td>
                          <span className={`status ${bundleStatusClass(bundle.statusLabel)}`}>
                            {bundle.statusLabel}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {targetPackage && (
                              <>
                                <button className="action-btn" type="button" onClick={() => openPackageDetail(targetPackage)}>
                                  Detail
                                </button>
                                <button className="action-btn" type="button" onClick={() => openVariantManager(targetPackage)}>
                                  Kelola Variant
                                </button>
                                <button className="action-btn" type="button" onClick={() => openEditPackageForm(targetPackage)}>
                                  Edit Paket
                                </button>
                                <button
                                  className="action-btn"
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void togglePackageActive(targetPackage)}
                                >
                                  {packageToggle?.label || 'Ubah Status'}
                                </button>
                              </>
                            )}
                            {bundle.checkoutHref ? (
                              <a className="action-btn" href={bundle.checkoutHref}>
                                Cek Checkout
                              </a>
                            ) : (
                              <span className="action-btn muted" aria-disabled="true">
                                Checkout nonaktif
                              </span>
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
        </div>
      )}

      {packageFormOpen && (
        <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closePackageForm}>
          <div
            className="modal-card"
            style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(760px, 96vw)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={MODAL_HEAD_STYLE}>
              <div>
                <h3>{packageModalCopy.title}</h3>
                <div className="modal-sub" style={MODAL_SUB_STYLE}>{packageModalCopy.subtitle}</div>
              </div>
              <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closePackageForm}>×</button>
            </div>

            <div className="modal-body" style={MODAL_BODY_STYLE}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Key Paket</label>
                  <input
                    className="form-input"
                    value={packageForm.key}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, key: event.target.value }))}
                    disabled={packageModalCopy.keyDisabled}
                    placeholder="contoh: umkm-starter"
                  />
                </div>
                <div>
                  <label className="form-label">Platform</label>
                  <input
                    className="form-input"
                    value={packageForm.platform}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, platform: event.target.value }))}
                    placeholder="Instagram / TikTok / Multi Platform"
                  />
                </div>
                <div>
                  <label className="form-label">Urutan</label>
                  <input
                    className="form-input"
                    type="number"
                    value={packageForm.sort_order}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  value={packageForm.title}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Contoh: UMKM Starter"
                />
              </div>

              <div>
                <label className="form-label">Subtitle</label>
                <input
                  className="form-input"
                  value={packageForm.subtitle}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                  placeholder="Paket awal buat naikkin trust toko"
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={packageForm.description}
                  onChange={(event) => setPackageForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Deskripsi paket yang tampil di katalog publik."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="form-label">Badge</label>
                  <input
                    className="form-input"
                    value={packageForm.badge}
                    onChange={(event) => setPackageForm((prev) => ({ ...prev, badge: event.target.value }))}
                    placeholder="Rekomendasi"
                  />
                </div>
                <div style={{ display: 'grid', gap: 8, alignContent: 'end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={packageForm.is_highlighted}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, is_highlighted: event.target.checked }))}
                    />
                    Highlight package di katalog
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={packageForm.is_active}
                      onChange={(event) => setPackageForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    />
                    Aktif untuk katalog publik
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
              <button className="action-btn" type="button" onClick={closePackageForm} disabled={saving}>
                Batal
              </button>
              <button className="topbar-btn primary" type="button" onClick={submitPackageForm} disabled={saving}>
                {saving ? 'Menyimpan...' : packageModalCopy.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {packageDetailTarget && (() => {
        const detailSummary = getPackageDetailSummary(packageDetailTarget)
        const packageToggle = getPackageStatusToggle(packageDetailTarget)

        return (
          <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={() => setPackageDetailTarget(null)}>
            <div
              className="modal-card"
              style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(760px, 96vw)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head" style={MODAL_HEAD_STYLE}>
                <div>
                  <h3>Detail Paket Spesial</h3>
                  <div className="modal-sub" style={MODAL_SUB_STYLE}>{detailSummary.key}</div>
                </div>
                <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={() => setPackageDetailTarget(null)}>×</button>
              </div>

              <div className="modal-body" style={MODAL_BODY_STYLE}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Paket</div>
                    <div style={{ fontWeight: 800 }}>{detailSummary.title || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {detailSummary.platform} • {packageDetailTarget.badge || '-'}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{packageDetailTarget.subtitle || '-'}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{packageDetailTarget.description || '-'}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                    <div>
                      <span className={`status ${detailSummary.statusLabel === 'Aktif' ? 's-lunas' : 's-gagal'}`}>
                        {detailSummary.statusLabel}
                      </span>
                      {packageDetailTarget.is_highlighted && <span className="status s-proses" style={{ marginLeft: 6 }}>Highlight</span>}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Sort order: <strong>{packageDetailTarget.sort_order ?? 100}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Variant: <strong>{detailSummary.variantCount}</strong>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      Item aktif: <strong>{detailSummary.activeItemCount}</strong> / {detailSummary.itemCount}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
                <button className="action-btn" type="button" onClick={() => setPackageDetailTarget(null)}>
                  Tutup
                </button>
                <button
                  className="action-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => void togglePackageActive(packageDetailTarget)}
                >
                  {packageToggle.label}
                </button>
                <button
                  className="action-btn"
                  type="button"
                  onClick={() => openVariantManager(packageDetailTarget)}
                >
                  Kelola Variant
                </button>
                <button
                  className="topbar-btn primary"
                  type="button"
                  onClick={() => {
                    setPackageDetailTarget(null)
                    openEditPackageForm(packageDetailTarget)
                  }}
                >
                  Edit Paket
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {variantManagerPackageCurrent && variantModalCopy && (() => {
        const targetPackage = variantManagerPackageCurrent
        const sortedVariants = [...(targetPackage.variants || [])].sort((left, right) => {
          const leftSort = left.sort_order ?? 100
          const rightSort = right.sort_order ?? 100
          if (leftSort !== rightSort) return leftSort - rightSort
          return (left.key || '').localeCompare(right.key || '')
        })

        return (
          <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeVariantManager}>
            <div
              className="modal-card"
              style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(1040px, 96vw)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head" style={MODAL_HEAD_STYLE}>
                <div>
                  <h3>Kelola Variant Paket</h3>
                  <div className="modal-sub" style={MODAL_SUB_STYLE}>
                    {targetPackage.title || '-'} • <code>{targetPackage.key}</code>
                  </div>
                </div>
                <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeVariantManager}>×</button>
              </div>

              <div className="modal-body" style={MODAL_BODY_STYLE}>
                <div
                  className="card"
                  style={{
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{targetPackage.title || '-'}</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>
                      {targetPackage.platform || '-'} • {targetPackage.is_active ? 'Paket aktif' : 'Paket nonaktif'} • {sortedVariants.length} variant
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                      Variant key immutable setelah dibuat. Item layanan bisa dikelola per variant dari panel ini.
                    </div>
                  </div>
                  <button
                    className="topbar-btn primary"
                    type="button"
                    onClick={() => openCreateVariantForm(targetPackage)}
                    disabled={saving}
                  >
                    + Tambah Variant
                  </button>
                </div>

                {variantFormOpen && (
                  <div className="card" style={{ padding: 12, borderColor: '#BFDBFE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{variantModalCopy.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{variantModalCopy.subtitle}</div>
                      </div>
                      <span className="status s-proses">{variantPriceFieldVisibility.helpText}</span>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <label className="form-label">Key Variant</label>
                          <input
                            className="form-input"
                            value={variantForm.key}
                            onChange={(event) => setVariantForm((prev) => ({ ...prev, key: event.target.value }))}
                            disabled={variantModalCopy.keyDisabled}
                            placeholder="contoh: starter"
                          />
                        </div>
                        <div>
                          <label className="form-label">Nama Variant</label>
                          <input
                            className="form-input"
                            value={variantForm.name}
                            onChange={(event) => setVariantForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Starter / Growth / Pro"
                          />
                        </div>
                        <div>
                          <label className="form-label">Urutan</label>
                          <input
                            className="form-input"
                            type="number"
                            value={variantForm.sort_order}
                            onChange={(event) => setVariantForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-textarea"
                          rows={2}
                          value={variantForm.description}
                          onChange={(event) => setVariantForm((prev) => ({ ...prev, description: event.target.value }))}
                          placeholder="Deskripsi singkat variant"
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <label className="form-label">Price Mode</label>
                          <select
                            className="form-select"
                            value={variantForm.price_mode}
                            onChange={(event) => {
                              const priceMode = event.target.value
                              setVariantForm((prev) => ({
                                ...prev,
                                price_mode: priceMode,
                                fixed_price: priceMode === 'fixed' ? prev.fixed_price : '0',
                                discount_percent: priceMode === 'computed_with_discount' ? prev.discount_percent : '0',
                                discount_amount: priceMode === 'computed_with_discount' ? prev.discount_amount : '0',
                              }))
                            }}
                          >
                            <option value="computed">Computed dari item aktif</option>
                            <option value="fixed">Fixed price</option>
                            <option value="computed_with_discount">Computed + discount</option>
                          </select>
                        </div>

                        {variantPriceFieldVisibility.showFixedPrice && (
                          <div>
                            <label className="form-label">Fixed Price</label>
                            <input
                              className="form-input"
                              type="number"
                              min={0}
                              value={variantForm.fixed_price}
                              onChange={(event) => setVariantForm((prev) => ({ ...prev, fixed_price: event.target.value }))}
                              placeholder="50000"
                            />
                          </div>
                        )}

                        {variantPriceFieldVisibility.showDiscountFields && (
                          <>
                            <div>
                              <label className="form-label">Discount Percent</label>
                              <input
                                className="form-input"
                                type="number"
                                min={0}
                                max={100}
                                value={variantForm.discount_percent}
                                onChange={(event) => setVariantForm((prev) => ({ ...prev, discount_percent: event.target.value }))}
                                placeholder="10"
                              />
                            </div>
                            <div>
                              <label className="form-label">Discount Amount</label>
                              <input
                                className="form-input"
                                type="number"
                                min={0}
                                value={variantForm.discount_amount}
                                onChange={(event) => setVariantForm((prev) => ({ ...prev, discount_amount: event.target.value }))}
                                placeholder="5000"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={variantForm.is_active}
                            onChange={(event) => setVariantForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          />
                          Aktif untuk checkout publik
                        </label>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="action-btn" type="button" onClick={closeVariantForm} disabled={saving}>
                            Batal
                          </button>
                          <button className="topbar-btn primary" type="button" onClick={submitVariantForm} disabled={saving}>
                            {saving ? 'Menyimpan...' : variantModalCopy.submitLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {sortedVariants.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Belum ada variant untuk paket ini. Klik + Tambah Variant buat bikin pilihan checkout pertama.
                  </div>
                ) : (
                  <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--line, #E5E7EB)', borderRadius: 10 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>Price Mode</th>
                          <th>Harga</th>
                          <th>Item</th>
                          <th>Status</th>
                          <th style={{ width: 280 }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedVariants.map((variant) => {
                          const variantToggle = getVariantStatusToggle(variant)
                          const variantItems = variant.items || []
                          const activeItemCount = variantItems.filter((item) => item.is_active && item.service_is_active).length
                          const priceLabel = variant.price_mode === 'fixed'
                            ? `Fixed ${formatRupiah(variant.fixed_price || variant.total_price || 0)}`
                            : formatRupiah(variant.total_price || 0)
                          const discountLabel = variant.price_mode === 'computed_with_discount'
                            ? `Diskon ${variant.discount_percent || 0}% + ${formatRupiah(variant.discount_amount || variant.discount_amount_calculated || 0)}`
                            : variant.price_mode === 'computed'
                              ? 'Computed dari item aktif'
                              : 'Harga fixed manual'

                          return (
                            <tr key={variant.id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{variant.name || '-'}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}><code>{variant.key}</code></div>
                                {variant.description && (
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{variant.description}</div>
                                )}
                              </td>
                              <td>{variant.price_mode || '-'}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{priceLabel}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{discountLabel}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{activeItemCount}/{variantItems.length} aktif</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  {variantItems.slice(0, 2).map((item) => item.label || item.service_title || item.service_code).join(', ') || 'Item belum diatur'}
                                  {variantItems.length > 2 ? ` +${variantItems.length - 2} lagi` : ''}
                                </div>
                              </td>
                              <td>
                                <span className={`status ${variant.is_active ? 's-lunas' : 's-gagal'}`}>
                                  {variant.is_active ? 'Aktif' : 'Nonaktif'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button className="action-btn" type="button" onClick={() => openEditVariantForm(targetPackage, variant)}>
                                    Edit Variant
                                  </button>
                                  <button
                                    className="action-btn"
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void toggleVariantActive(variant)}
                                  >
                                    {variantToggle.label}
                                  </button>
                                  <button
                                    className="action-btn"
                                    type="button"
                                    onClick={() => openItemManager(variant)}
                                    disabled={saving}
                                  >
                                    Kelola Item
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

              <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
                <button className="action-btn" type="button" onClick={closeVariantManager} disabled={saving}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {itemManagerVariantCurrent && itemModalCopy && (() => {
        const targetVariant = itemManagerVariantCurrent
        const variantItems = [...(targetVariant.items || [])].sort((left, right) => {
          const leftSort = left.sort_order ?? 100
          const rightSort = right.sort_order ?? 100
          if (leftSort !== rightSort) return leftSort - rightSort
          return (left.label || left.service_title || left.service_code || '').localeCompare(
            right.label || right.service_title || right.service_code || ''
          )
        })
        const activeItemCount = variantItems.filter((item) => item.is_active && item.service_is_active).length
        const selectedServiceMissing = !!itemForm.sosmed_service_id && !bundleServiceOptions.some((option) => option.value === itemForm.sosmed_service_id)

        return (
          <div className="modal-overlay" style={MODAL_OVERLAY_STYLE} onClick={closeItemManager}>
            <div
              className="modal-card"
              style={{ ...MODAL_CARD_BASE_STYLE, width: 'min(980px, 96vw)' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head" style={MODAL_HEAD_STYLE}>
                <div>
                  <h3>Kelola Item Variant</h3>
                  <div className="modal-sub" style={MODAL_SUB_STYLE}>
                    {targetVariant.name || '-'} • <code>{targetVariant.key}</code>
                  </div>
                </div>
                <button className="modal-close" style={MODAL_CLOSE_STYLE} type="button" onClick={closeItemManager}>×</button>
              </div>

              <div className="modal-body" style={MODAL_BODY_STYLE}>
                <div
                  className="card"
                  style={{
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{targetVariant.name || '-'}</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>
                      {activeItemCount}/{variantItems.length} item aktif • Subtotal {formatRupiah(targetVariant.subtotal_price || 0)} • Total {formatRupiah(targetVariant.total_price || 0)}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                      Price mode {targetVariant.price_mode || 'computed'} • Original {formatRupiah(targetVariant.original_price || 0)} • Discount {formatRupiah(targetVariant.discount_amount_calculated || targetVariant.discount_amount || 0)}
                    </div>
                  </div>
                  <button
                    className="topbar-btn primary"
                    type="button"
                    onClick={() => openCreateItemForm(targetVariant)}
                    disabled={saving}
                  >
                    + Tambah Item
                  </button>
                </div>

                {itemFormOpen && (
                  <div className="card" style={{ padding: 12, borderColor: '#BFDBFE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{itemModalCopy.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{itemModalCopy.subtitle}</div>
                      </div>
                      <span className="status s-proses">Service admin include inactive</span>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      <div>
                        <label className="form-label">Master Layanan</label>
                        <select
                          className="form-select"
                          value={itemForm.sosmed_service_id}
                          onChange={(event) => setItemForm((prev) => ({ ...prev, sosmed_service_id: event.target.value }))}
                        >
                          <option value="">Pilih layanan sosmed...</option>
                          {selectedServiceMissing && (
                            <option value={itemForm.sosmed_service_id}>
                              Service saat ini tidak ada di list admin ({itemForm.sosmed_service_id})
                            </option>
                          )}
                          {bundleServiceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                          Format: [code] title • platform • Rp checkout_price/1K, termasuk service nonaktif untuk audit item.
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 0.7fr', gap: 8 }}>
                        <div>
                          <label className="form-label">Label Override</label>
                          <input
                            className="form-input"
                            value={itemForm.label}
                            onChange={(event) => setItemForm((prev) => ({ ...prev, label: event.target.value }))}
                            placeholder="Kosongkan untuk pakai title layanan"
                          />
                        </div>
                        <div>
                          <label className="form-label">Quantity Units</label>
                          <input
                            className="form-input"
                            type="number"
                            min={1}
                            value={itemForm.quantity_units}
                            onChange={(event) => setItemForm((prev) => ({ ...prev, quantity_units: event.target.value }))}
                            placeholder="1000"
                          />
                        </div>
                        <div>
                          <label className="form-label">Target Strategy</label>
                          <select
                            className="form-select"
                            value={itemForm.target_strategy}
                            onChange={(event) => setItemForm((prev) => ({ ...prev, target_strategy: event.target.value }))}
                          >
                            <option value="same_target">Same target checkout</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Urutan</label>
                          <input
                            className="form-input"
                            type="number"
                            value={itemForm.sort_order}
                            onChange={(event) => setItemForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={itemForm.is_active}
                            onChange={(event) => setItemForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          />
                          Item aktif untuk kalkulasi/checkout publik
                        </label>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="action-btn" type="button" onClick={closeItemForm} disabled={saving}>
                            Batal
                          </button>
                          <button className="topbar-btn primary" type="button" onClick={() => void submitItemForm()} disabled={saving}>
                            {saving ? 'Menyimpan...' : itemModalCopy.submitLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {variantItems.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Belum ada item layanan untuk variant ini. Klik + Tambah Item buat merangkai layanan satuan ke paket.
                  </div>
                ) : (
                  <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--line, #E5E7EB)', borderRadius: 10 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Quantity</th>
                          <th>Target</th>
                          <th>Harga Line</th>
                          <th>Status</th>
                          <th style={{ width: 220 }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantItems.map((item) => {
                          const itemToggle = getItemStatusToggle(item)
                          const itemTitle = item.label || item.service_title || item.service_code || '-'

                          return (
                            <tr key={item.id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{itemTitle}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}><code>{item.service_code || '-'}</code></div>
                                <div style={{ fontSize: 11, color: item.service_is_active ? 'var(--muted)' : '#DC2626' }}>
                                  {item.service_is_active ? 'Master service aktif' : 'Master service nonaktif'}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.quantity_units.toLocaleString('id-ID')}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sort {item.sort_order ?? 100}</div>
                              </td>
                              <td>{item.target_strategy || 'same_target'}</td>
                              <td>{formatRupiah(item.line_price || 0)}</td>
                              <td>
                                <span className={`status ${item.is_active ? 's-lunas' : 's-gagal'}`}>
                                  {item.is_active ? 'Aktif' : 'Nonaktif'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button className="action-btn" type="button" onClick={() => openEditItemForm(targetVariant, item)}>
                                    Edit Item
                                  </button>
                                  <button
                                    className="action-btn"
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void toggleItemActive(item)}
                                  >
                                    {itemToggle.label}
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

              <div className="modal-actions" style={MODAL_ACTIONS_STYLE}>
                <button className="action-btn" type="button" onClick={closeItemManager} disabled={saving}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
