"use client"

import { LOOKUP_PRELOAD_LIMIT } from '@/config/pagination'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

import {
  AdminDialog,
  AdminFilterBar,
  AdminPageHeader,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/admin/admin-ui'
import AdminMobileCardList from '@/components/admin/admin-mobile-card-list'
import { accountTypeService } from '@/services/accountTypeService'
import { productCategoryService } from '@/services/productCategoryService'
import { productService } from '@/services/productService'
import type { AccountType } from '@/types/accountType'
import type { ProductCategory } from '@/types/productCategory'
import type {
  Product,
  ProductFAQItem,
  ProductPrice,
  ProductSpecItem,
  ProductTrustBadge,
} from '@/types/product'

type FormState = {
  name: string
  slug: string
  category: string
  description: string
  tagline: string
  icon: string
  icon_image_url: string
  cover_images: string[]
  color: string
  hero_bg_url: string
  badge_popular_text: string
  badge_guarantee_text: string
  sold_text: string
  shared_note: string
  private_note: string
  feature_items: string[]
  spec_items: ProductSpecItem[]
  trust_items: string[]
  trust_badges: ProductTrustBadge[]
  faq_items: ProductFAQItem[]
  price_original_text: string
  price_per_day_text: string
  discount_badge_text: string
  show_whatsapp_button: boolean
  whatsapp_number: string
  whatsapp_button_text: string
  seo_description: string
  fulfillment_type: Product['fulfillment_type']
  fulfillment_guide: string
  metadata: Record<string, unknown>
  sort_priority: number
  is_popular: boolean
  is_active: boolean
}

type ProductPriceDraft = {
  local_id: string
  id?: string
  duration: number
  account_type: ProductPrice['account_type']
  label: string
  savings_text: string
  price: number
  is_active: boolean
}

type CategoryOption = {
  value: string
  label: string
  is_active?: boolean
}

const DEFAULT_PREM_APPS_CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'streaming', label: 'Streaming', is_active: true },
  { value: 'music', label: 'Musik', is_active: true },
  { value: 'gaming', label: 'Gaming', is_active: true },
  { value: 'design', label: 'Desain', is_active: true },
  { value: 'productivity', label: 'Produktivitas', is_active: true },
]

const FALLBACK_ACCOUNT_TYPE_CODES = ['shared', 'private']

const FULFILLMENT_TYPE_OPTIONS: Array<{ value: NonNullable<Product['fulfillment_type']>; label: string; hint: string }> = [
  { value: 'credential', label: 'Credential', hint: 'Email/password atau akses akun' },
  { value: 'license_key', label: 'License Key', hint: 'Kode lisensi per pembelian' },
  { value: 'voucher_code', label: 'Voucher Code', hint: 'Kode redeem/voucher' },
  { value: 'download_link', label: 'Download Link', hint: 'Link file atau asset digital' },
  { value: 'manual', label: 'Manual', hint: 'Instruksi dikirim manual/CS' },
]

const DEFAULT_TRUST_BADGES: ProductTrustBadge[] = [
  { icon: '🛡', text: 'Garansi 30 Hari' },
  { icon: '⚡', text: 'Pengiriman Instan' },
  { icon: '💬', text: 'Support 24/7' },
]

const DEFAULT_FEATURE_ITEMS = [
  'Akun dari stok terverifikasi',
  'Pengiriman otomatis setelah pembayaran',
  'Garansi aktif selama masa langganan',
]

const DEFAULT_SPEC_ITEMS: ProductSpecItem[] = [
  { label: 'Jenis Akun', value: 'Shared / Private sesuai paket' },
  { label: 'Pengiriman', value: 'Otomatis setelah pembayaran sukses' },
  { label: 'Garansi', value: 'Berlaku sesuai kebijakan produk' },
]

const DEFAULT_FAQ_ITEMS: ProductFAQItem[] = [
  {
    question: 'Apakah akun ini aman digunakan?',
    answer: 'Aman. Akun premium dikirim dari stok terverifikasi dan ada dukungan CS kalau ada kendala.',
  },
]

function createDefaultForm(): FormState {
  return {
    name: '',
    slug: '',
    category: 'streaming',
    description: '',
    tagline: '',
    icon: '📦',
    icon_image_url: '',
    cover_images: [],
    color: '#FDDAC8',
    hero_bg_url: '',
    badge_popular_text: '🔥 Terlaris',
    badge_guarantee_text: '🛡 Garansi 30 Hari',
    sold_text: '',
    shared_note: 'Berbagi dengan pengguna lain',
    private_note: 'Akun pribadi, akses penuh',
    feature_items: [...DEFAULT_FEATURE_ITEMS],
    spec_items: DEFAULT_SPEC_ITEMS.map((item) => ({ ...item })),
    trust_items: DEFAULT_TRUST_BADGES.map((item) => item.text),
    trust_badges: DEFAULT_TRUST_BADGES.map((item) => ({ ...item })),
    faq_items: DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
    price_original_text: '',
    price_per_day_text: '',
    discount_badge_text: '',
    show_whatsapp_button: true,
    whatsapp_number: '',
    whatsapp_button_text: 'Tanya via WhatsApp',
    seo_description: '',
    fulfillment_type: 'credential',
    fulfillment_guide: '',
    metadata: {},
    sort_priority: 0,
    is_popular: false,
    is_active: true,
  }
}

function createPriceDraft(partial?: Partial<ProductPriceDraft>): ProductPriceDraft {
  const localId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `price-${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    local_id: localId,
    duration: 1,
    account_type: 'shared',
    label: '1 Bulan',
    savings_text: '',
    price: 10000,
    is_active: true,
    ...partial,
  }
}

function normalizePriceDrafts(prices: ProductPrice[]): ProductPriceDraft[] {
  return prices
    .slice()
    .sort((a, b) => {
      if (a.account_type !== b.account_type) {
        return a.account_type.localeCompare(b.account_type)
      }
      return a.duration - b.duration
    })
    .map((price) =>
      createPriceDraft({
        id: price.id,
        duration: price.duration,
        account_type: price.account_type,
        label: price.label || `${price.duration} Bulan`,
        savings_text: price.savings_text || '',
        price: price.price,
        is_active: price.is_active,
      })
    )
}

function normalizeStringItems(items: string[], max = 10): string[] {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
}

function normalizeFaqItems(items: ProductFAQItem[], max = 10): ProductFAQItem[] {
  return items
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, max)
}

function normalizeSpecItems(items: ProductSpecItem[], max = 16): ProductSpecItem[] {
  return items
    .map((item) => ({
      label: item.label.trim(),
      value: item.value.trim(),
    }))
    .filter((item) => item.label && item.value)
    .slice(0, max)
}

function normalizeTrustBadges(items: ProductTrustBadge[], max = 10): ProductTrustBadge[] {
  return items
    .map((item) => ({
      icon: item.icon.trim() || '✨',
      text: item.text.trim(),
    }))
    .filter((item) => item.text)
    .slice(0, max)
}

function deriveTrustItemsFromBadges(items: ProductTrustBadge[]): string[] {
  return items.map((item) => item.text).filter(Boolean)
}

function sanitizeWhatsAppNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 20)
}

function normalizePriceLabel(label: string, duration: number) {
  const trimmed = label.trim()
  if (trimmed) return trimmed
  return `${Math.max(duration, 1)} Bulan`
}

function findNextAvailableDuration(rows: ProductPriceDraft[], accountType: string) {
  const normalizedType = normalizeAccountTypeCode(accountType)
  const used = new Set<number>()

  rows.forEach((row) => {
    if (normalizeAccountTypeCode(row.account_type) !== normalizedType) return
    const duration = Math.max(1, Number(row.duration) || 1)
    used.add(duration)
  })

  let next = 1
  while (used.has(next)) {
    next += 1
  }

  return next
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\+/g, 'plus')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getCategoryLabel(value: string, options: CategoryOption[]) {
  return options.find((c) => c.value === value)?.label ?? value
}

function toCategoryOptions(items: ProductCategory[]): CategoryOption[] {
  if (!items.length) return DEFAULT_PREM_APPS_CATEGORY_OPTIONS

  return items.map((item) => ({
    value: item.code,
    label: item.label || item.code,
    is_active: item.is_active,
  }))
}

function normalizeAccountTypeCode(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function accountTypeOptionLabel(item: Pick<AccountType, 'code' | 'label' | 'is_active'>) {
  const label = item.label?.trim() || item.code
  return item.is_active ? label : `${label} · (Nonaktif)`
}

function summarizePrices(prices: ProductPrice[], accountTypeMap?: Record<string, AccountType>) {
  if (!prices || prices.length === 0) return 'Belum ada paket'

  const active = prices.filter((p) => p.is_active)
  const source = active.length > 0 ? active : prices

  const byType = source.reduce<Record<string, number>>((acc, price) => {
    const code = normalizeAccountTypeCode(price.account_type)
    if (!code) return acc
    acc[code] = (acc[code] || 0) + 1
    return acc
  }, {})

  return Object.entries(byType)
    .sort(([leftCode], [rightCode]) => {
      const leftOrder = accountTypeMap?.[leftCode]?.sort_order ?? 999
      const rightOrder = accountTypeMap?.[rightCode]?.sort_order ?? 999
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return leftCode.localeCompare(rightCode)
    })
    .map(([code, total]) => {
      const label = accountTypeMap?.[code]?.label || code
      return `${label} ${total}`
    })
    .join(' · ')
}

function getLowestPrice(product: Product): number | null {
  if (!product.prices || product.prices.length === 0) return null
  const activePrices = product.prices.filter((p) => p.is_active)
  const source = activePrices.length > 0 ? activePrices : product.prices
  const sorted = source.map((p) => p.price).sort((a, b) => a - b)
  return sorted[0] ?? null
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }
  return fallback
}

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([])
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(DEFAULT_PREM_APPS_CATEGORY_OPTIONS)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [typeSelectOpen, setTypeSelectOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(createDefaultForm())
  const [slugTouched, setSlugTouched] = useState(false)

  const [priceDrafts, setPriceDrafts] = useState<ProductPriceDraft[]>([])
  const [removedPriceIds, setRemovedPriceIds] = useState<string[]>([])
  const [uploadingAssetKind, setUploadingAssetKind] = useState<null | 'icon' | 'hero' | 'cover'>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDescription, setConfirmDescription] = useState('')
  const [confirmAction, setConfirmAction] = useState<null | { type: 'archive' | 'hard-delete'; product: Product }>(null)

  const accountTypeMap = useMemo(() => {
    return accountTypes.reduce<Record<string, AccountType>>((acc, item) => {
      const code = normalizeAccountTypeCode(item.code)
      if (!code) return acc
      acc[code] = item
      return acc
    }, {})
  }, [accountTypes])

  const CATEGORY_TEMPLATES: Record<string, { defaultFulfillment: Product['fulfillment_type']; hiddenFields: string[] }> = {
    streaming: { defaultFulfillment: 'credential', hiddenFields: [] },
    music: { defaultFulfillment: 'credential', hiddenFields: [] },
    gaming: { defaultFulfillment: 'manual', hiddenFields: ['shared_note', 'private_note'] },
    design: { defaultFulfillment: 'credential', hiddenFields: [] },
    productivity: { defaultFulfillment: 'license_key', hiddenFields: ['shared_note', 'private_note'] },
  }


const PRODUCT_TYPE_OPTIONS = [
  { value: 'subscription', label: 'Akun Premium', icon: '👤', desc: 'Akun sharing/private (Netflix, Spotify, dsb)', defaultFulfillment: 'credential', defaultCategory: 'streaming' },
  { value: 'game', label: 'Akun Game', icon: '🎮', desc: 'Akun game / top-up / joki', defaultFulfillment: 'manual', defaultCategory: 'gaming' },
  { value: 'license', label: 'Lisensi / Key', icon: '🔑', desc: 'Kode lisensi, software key, redeem code', defaultFulfillment: 'license_key', defaultCategory: 'productivity' },
  { value: 'digital', label: 'Voucher / Digital', icon: '🎟', desc: 'Voucher, gift card, download link', defaultFulfillment: 'voucher_code', defaultCategory: 'design' },
]

const PRODUCT_TYPE_DETAIL_CONFIG: Record<string, { title: string; description: string; fulfillmentLabel: string }> = {
  subscription: {
    title: 'Detail Akun Premium',
    description: 'Atur catatan akses akun, format credential, garansi, dan instruksi penggunaan.',
    fulfillmentLabel: 'Credential — Email/password atau akses akun',
  },
  game: {
    title: 'Detail Akun Game',
    description: 'Atur platform, region, requirement login, keamanan akun, dan delivery manual.',
    fulfillmentLabel: 'Manual — Instruksi dikirim manual oleh CS/admin',
  },
  license: {
    title: 'Detail Lisensi / Key',
    description: 'Atur jenis lisensi, batas device, masa berlaku, dan cara aktivasi kode.',
    fulfillmentLabel: 'License Key — Kode lisensi per pembelian',
  },
  digital: {
    title: 'Detail Voucher / Digital',
    description: 'Atur jenis digital, nominal, region, masa berlaku, link redeem, dan cara klaim.',
    fulfillmentLabel: 'Voucher Code — Kode redeem/voucher',
  },
}

const PRODUCT_TYPE_DEFAULTS: Record<string, Partial<FormState>> = {
  subscription: {
    icon: '👤',
    tagline: 'Akses akun premium siap pakai',
    badge_guarantee_text: '🛡 Garansi Akun',
    shared_note: 'Berbagi dengan pengguna lain sesuai paket',
    private_note: 'Akun pribadi, akses lebih fleksibel',
    fulfillment_guide: 'Credential dikirim setelah pembayaran sukses. Ikuti instruksi login yang tersedia di dashboard pembeli.',
  },
  game: {
    icon: '🎮',
    tagline: 'Akun game dan layanan manual',
    badge_guarantee_text: '🛡 Bantuan CS',
    fulfillment_guide: 'Admin/CS akan memproses delivery manual setelah pembayaran sukses. Pastikan data login atau ID game sudah benar.',
  },
  license: {
    icon: '🔑',
    tagline: 'Kode lisensi siap aktivasi',
    badge_guarantee_text: '🛡 Garansi Aktivasi',
    fulfillment_guide: 'Kode lisensi dikirim setelah pembayaran sukses. Ikuti panduan aktivasi sesuai produk.',
  },
  digital: {
    icon: '🎟',
    tagline: 'Voucher dan file digital siap klaim',
    badge_guarantee_text: '🛡 Garansi Redeem',
    fulfillment_guide: 'Kode atau link redeem dikirim setelah pembayaran sukses. Klaim sesuai instruksi produk.',
  },
}

function createDefaultMetadataForType(type: string): Record<string, unknown> {
  if (type === 'subscription') {
    return { product_type: type, access_type: '', credential_format: '', account_warranty: '' }
  }
  if (type === 'game') {
    return { product_type: type, platform: '', region: '', login_requirement: '', account_security: '', game_info: '' }
  }
  if (type === 'license') {
    return { product_type: type, license_type: '', device_limit: '', license_expiry: '', license_info: '' }
  }
  if (type === 'digital') {
    return { product_type: type, digital_type: '', voucher_value: '', region: '', voucher_expiry: '', voucher_info: '', download_link: '' }
  }

  return { product_type: type }
}

  const currentTemplate = CATEGORY_TEMPLATES[form.category]
  const showField = (field: string) => !currentTemplate?.hiddenFields.includes(field)

  const activeAccountTypeOptions = useMemo(() => {
    const sorted = [...accountTypes]
      .filter((item) => item.is_active)
      .sort((left, right) => {
        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order
        }
        return left.code.localeCompare(right.code)
      })
      .map((item) => ({ value: normalizeAccountTypeCode(item.code), label: accountTypeOptionLabel(item) }))

    if (sorted.length > 0) {
      return sorted
    }

    return FALLBACK_ACCOUNT_TYPE_CODES.map((code) => ({
      value: code,
      label: code,
    }))
  }, [accountTypes])

  const accountTypeOptionsByValue = useMemo(() => {
    return activeAccountTypeOptions.reduce<Record<string, { value: string; label: string }>>((acc, option) => {
      acc[option.value] = option
      return acc
    }, {})
  }, [activeAccountTypeOptions])

  const activePremAppsCategoryOptions = useMemo(() => {
    const active = categoryOptions.filter((item) => item.is_active !== false)
    if (active.length > 0) return active
    return categoryOptions
  }, [categoryOptions])

  const formCategoryOptions = useMemo(() => {
    if (!form.category) return activePremAppsCategoryOptions

    const exists = activePremAppsCategoryOptions.some((item) => item.value === form.category)
    if (exists) return activePremAppsCategoryOptions

    return [
      ...activePremAppsCategoryOptions,
      {
        value: form.category,
        label: `${getCategoryLabel(form.category, categoryOptions)} (legacy)`,
        is_active: false,
      },
    ]
  }, [activePremAppsCategoryOptions, categoryOptions, form.category])

  const loadAccountTypes = async () => {
    try {
      const res = await accountTypeService.adminList({ include_inactive: true })
      if (!res.success) return
      setAccountTypes(res.data || [])
    } catch {
      // best effort only; fallback options still available
    }
  }

  const loadCategoryOptions = async () => {
    try {
      const res = await productCategoryService.adminList({ scope: 'prem_apps', include_inactive: true })
      if (!res.success) return

      const options = toCategoryOptions(res.data || [])
      if (options.length > 0) {
        setCategoryOptions(options)
      }
    } catch {
      // best effort only; fallback options still available
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await productService.adminList({ page: 1, limit: LOOKUP_PRELOAD_LIMIT })
      if (!res.success) {
        setError(res.message || 'Gagal memuat produk')
        return
      }

      setProducts(res.data)
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat produk admin'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadProducts(), loadAccountTypes(), loadCategoryOptions()])
  }, [])

  useEffect(() => {
    if (categoryFilter === 'all') return

    const exists = categoryOptions.some((item) => item.value === categoryFilter)
    if (!exists) {
      setCategoryFilter('all')
    }
  }, [categoryFilter, categoryOptions])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false
      if (statusFilter === 'active' && !product.is_active) return false
      if (statusFilter === 'inactive' && product.is_active) return false

      if (!keyword) return true

      const haystack = [
        product.name,
        product.slug,
        product.description,
        product.tagline || '',
        product.category,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [categoryFilter, products, search, statusFilter])

  const productStats = useMemo(() => {
    const active = products.filter((product) => product.is_active).length
    const popular = products.filter((product) => product.is_popular).length
    const categories = new Set(products.map((product) => product.category).filter(Boolean)).size
    const withPrices = products.filter((product) => product.prices?.some((price) => price.is_active)).length

    return {
      total: products.length,
      active,
      inactive: Math.max(products.length - active, 0),
      popular,
      categories,
      withPrices,
    }
  }, [products])

  const openCreate = () => {
    setTypeSelectOpen(true)
  }

  const onSelectProductType = (type: string) => {
    setTypeSelectOpen(false)
    setFormMode('create')
    setEditingId(null)
    setSlugTouched(false)

    const opt = PRODUCT_TYPE_OPTIONS.find((o) => o.value === type)
    const defaultCategory = opt?.defaultCategory ||
      activePremAppsCategoryOptions[0]?.value ||
      categoryOptions[0]?.value ||
      DEFAULT_PREM_APPS_CATEGORY_OPTIONS[0]?.value ||
      'streaming'

    setForm({
      ...createDefaultForm(),
      ...PRODUCT_TYPE_DEFAULTS[type],
      category: defaultCategory,
      fulfillment_type: (opt?.defaultFulfillment as Product['fulfillment_type']) || 'credential',
      metadata: createDefaultMetadataForType(type),
    })

    const primaryType = activeAccountTypeOptions[0]?.value || 'shared'
    const secondaryType = activeAccountTypeOptions[1]?.value || primaryType

    const nextDrafts = [
      createPriceDraft({ account_type: primaryType, duration: 1, price: 25000 }),
    ]

    if (secondaryType !== primaryType) {
      nextDrafts.push(createPriceDraft({ account_type: secondaryType, duration: 1, price: 50000 }))
    }

    setPriceDrafts(nextDrafts)
    setRemovedPriceIds([])
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setFormMode('edit')
    setEditingId(product.id)
    setSlugTouched(true)

    const normalizedTrustBadges =
      product.trust_badges && product.trust_badges.length > 0
        ? normalizeTrustBadges(product.trust_badges)
        : product.trust_items && product.trust_items.length > 0
          ? normalizeStringItems(product.trust_items).map((text, index) => ({
              icon: DEFAULT_TRUST_BADGES[index % DEFAULT_TRUST_BADGES.length]?.icon || '✨',
              text,
            }))
          : DEFAULT_TRUST_BADGES.map((item) => ({ ...item }))

    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description ?? '',
      tagline: product.tagline ?? '',
      icon: product.icon || '📦',
      icon_image_url: product.icon_image_url || '',
      cover_images: product.cover_images || [],
      color: product.color || '#FDDAC8',
      hero_bg_url: product.hero_bg_url || '',
      badge_popular_text: product.badge_popular_text || '🔥 Terlaris',
      badge_guarantee_text: product.badge_guarantee_text || '🛡 Garansi 30 Hari',
      sold_text: product.sold_text || '',
      shared_note: product.shared_note || 'Berbagi dengan pengguna lain',
      private_note: product.private_note || 'Akun pribadi, akses penuh',
      feature_items:
        product.feature_items && product.feature_items.length > 0
          ? normalizeStringItems(product.feature_items, 12)
          : [...DEFAULT_FEATURE_ITEMS],
      spec_items:
        product.spec_items && product.spec_items.length > 0
          ? normalizeSpecItems(product.spec_items)
          : DEFAULT_SPEC_ITEMS.map((item) => ({ ...item })),
      trust_items: deriveTrustItemsFromBadges(normalizedTrustBadges),
      trust_badges: normalizedTrustBadges,
      faq_items:
        product.faq_items && product.faq_items.length > 0
          ? product.faq_items.map((item) => ({
              question: item.question || '',
              answer: item.answer || '',
            }))
          : DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
      price_original_text: product.price_original_text || '',
      price_per_day_text: product.price_per_day_text || '',
      discount_badge_text: product.discount_badge_text || '',
      show_whatsapp_button: product.show_whatsapp_button !== false,
      whatsapp_number: product.whatsapp_number || '',
      whatsapp_button_text: product.whatsapp_button_text || 'Tanya via WhatsApp',
      seo_description: product.seo_description || '',
      fulfillment_type: product.fulfillment_type || 'credential',
      fulfillment_guide: product.fulfillment_guide || '',
      metadata: product.metadata || {},
      sort_priority: product.sort_priority || 0,
      is_popular: product.is_popular,
      is_active: product.is_active,
    })

    const primaryType = activeAccountTypeOptions[0]?.value || 'shared'
    const secondaryType = activeAccountTypeOptions[1]?.value || primaryType

    setPriceDrafts(
      product.prices?.length
        ? normalizePriceDrafts(product.prices)
        : [
            createPriceDraft({ account_type: primaryType, duration: 1, price: 25000 }),
            ...(secondaryType !== primaryType
              ? [createPriceDraft({ account_type: secondaryType, duration: 1, price: 50000 })]
              : []),
          ]
    )

    setRemovedPriceIds([])
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
  }

  const addPriceRow = (type: ProductPrice['account_type']) => {
    setPriceDrafts((prev) => {
      const accountType = normalizeAccountTypeCode(type) || activeAccountTypeOptions[0]?.value || 'shared'
      const nextDuration = findNextAvailableDuration(prev, accountType)

      const latestSameType = prev
        .filter((row) => normalizeAccountTypeCode(row.account_type) === accountType)
        .sort((left, right) => right.duration - left.duration)[0]

      const fallbackPrice = accountType === 'private' ? 50000 : 25000
      const seededPrice = latestSameType?.price && latestSameType.price > 0 ? latestSameType.price : fallbackPrice

      return [
        ...prev,
        createPriceDraft({
          account_type: accountType,
          duration: nextDuration,
          label: normalizePriceLabel('', nextDuration),
          price: seededPrice,
        }),
      ]
    })
  }

  const updatePriceRow = (localId: string, patch: Partial<ProductPriceDraft>) => {
    setPriceDrafts((prev) =>
      prev.map((row) => (row.local_id === localId ? { ...row, ...patch } : row))
    )
  }

  const removePriceRow = (localId: string) => {
    setPriceDrafts((prev) => {
      const target = prev.find((item) => item.local_id === localId)
      if (target?.id) {
        setRemovedPriceIds((current) => (current.includes(target.id as string) ? current : [...current, target.id as string]))
      }

      return prev.filter((item) => item.local_id !== localId)
    })
  }

  const updateFeatureItem = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      feature_items: prev.feature_items.map((item, itemIndex) =>
        itemIndex === index ? value : item
      ),
    }))
  }

  const addFeatureItem = () => {
    setForm((prev) => {
      if (prev.feature_items.length >= 12) return prev
      return {
        ...prev,
        feature_items: [...prev.feature_items, ''],
      }
    })
  }

  const removeFeatureItem = (index: number) => {
    setForm((prev) => {
      if (prev.feature_items.length <= 1) return prev
      return {
        ...prev,
        feature_items: prev.feature_items.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const updateSpecItem = (index: number, patch: Partial<ProductSpecItem>) => {
    setForm((prev) => ({
      ...prev,
      spec_items: prev.spec_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }))
  }

  const addSpecItem = () => {
    setForm((prev) => {
      if (prev.spec_items.length >= 16) return prev
      return {
        ...prev,
        spec_items: [...prev.spec_items, { label: '', value: '' }],
      }
    })
  }

  const removeSpecItem = (index: number) => {
    setForm((prev) => {
      if (prev.spec_items.length <= 1) return prev
      return {
        ...prev,
        spec_items: prev.spec_items.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const updateTrustBadge = (index: number, patch: Partial<ProductTrustBadge>) => {
    setForm((prev) => {
      const trustBadges = prev.trust_badges.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
      return {
        ...prev,
        trust_badges: trustBadges,
        trust_items: deriveTrustItemsFromBadges(normalizeTrustBadges(trustBadges)),
      }
    })
  }

  const addTrustBadge = () => {
    setForm((prev) => {
      if (prev.trust_badges.length >= 10) return prev
      const trustBadges = [...prev.trust_badges, { icon: '✨', text: '' }]
      return {
        ...prev,
        trust_badges: trustBadges,
        trust_items: deriveTrustItemsFromBadges(normalizeTrustBadges(trustBadges)),
      }
    })
  }

  const removeTrustBadge = (index: number) => {
    setForm((prev) => {
      if (prev.trust_badges.length <= 1) return prev
      const trustBadges = prev.trust_badges.filter((_, itemIndex) => itemIndex !== index)
      return {
        ...prev,
        trust_badges: trustBadges,
        trust_items: deriveTrustItemsFromBadges(normalizeTrustBadges(trustBadges)),
      }
    })
  }

  const updateFaqItem = (index: number, patch: Partial<ProductFAQItem>) => {
    setForm((prev) => ({
      ...prev,
      faq_items: prev.faq_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }))
  }

  const addFaqItem = () => {
    setForm((prev) => {
      if (prev.faq_items.length >= 10) return prev
      return {
        ...prev,
        faq_items: [...prev.faq_items, { question: '', answer: '' }],
      }
    })
  }

  const removeFaqItem = (index: number) => {
    setForm((prev) => {
      if (prev.faq_items.length <= 1) return prev
      return {
        ...prev,
        faq_items: prev.faq_items.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const validatePriceDrafts = () => {
    if (priceDrafts.length === 0) {
      return 'Minimal harus ada 1 paket harga aktif untuk produk DigiProduct.'
    }

    const seen = new Set<string>()
    for (const row of priceDrafts) {
      const accountTypeCode = normalizeAccountTypeCode(row.account_type)
      if (!accountTypeCode) {
        return 'Jenis akses pada paket harga wajib diisi.'
      }
      if (!accountTypeOptionsByValue[accountTypeCode]) {
        return `Jenis akses "${accountTypeCode}" belum aktif di master jenis akses.`
      }

      if (row.duration < 1) return 'Durasi paket harga minimal 1 bulan.'
      if (row.price < 1) return 'Nominal harga paket tidak boleh nol.'

      const signature = `${accountTypeCode}:${row.duration}`
      if (seen.has(signature)) {
        return `Duplikasi paket terdeteksi (${accountTypeCode} ${row.duration} bulan).`
      }
      seen.add(signature)
    }

    return ''
  }

  const validateProductTypeDetails = () => {
    const productType = form.metadata?.product_type as string | undefined
    if (!productType) {
      return 'Tipe produk wajib dipilih sebelum menyimpan produk.'
    }

    if (productType === 'subscription') {
      if (!form.shared_note.trim() && !form.private_note.trim() && !form.fulfillment_guide.trim()) {
        return 'Detail Akun Premium wajib punya minimal catatan akun atau panduan credential.'
      }
    }

    if (productType === 'game') {
      const platform = String(form.metadata?.platform || '').trim()
      const gameInfo = String(form.metadata?.game_info || '').trim()
      if (!platform && !gameInfo) {
        return 'Detail Akun Game wajib punya Platform / Server atau Requirement / Info Game.'
      }
    }

    if (productType === 'license') {
      const licenseInfo = String(form.metadata?.license_info || '').trim()
      if (!licenseInfo) {
        return 'Detail Lisensi wajib mengisi Informasi Lisensi.'
      }
    }

    if (productType === 'digital') {
      const voucherInfo = String(form.metadata?.voucher_info || '').trim()
      const downloadLink = String(form.metadata?.download_link || '').trim()
      if (!voucherInfo && !downloadLink) {
        return 'Detail Voucher / Digital wajib punya Info Voucher atau Link Download / Redeem.'
      }
    }

    return ''
  }

  const submitForm = async () => {
    if (!form.name.trim()) {
      setError('Nama produk wajib diisi')
      return
    }

    const productTypeError = validateProductTypeDetails()
    if (productTypeError) {
      setError(productTypeError)
      return
    }

    const validationError = validatePriceDrafts()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    const trustBadges = normalizeTrustBadges(form.trust_badges)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      description: form.description.trim(),
      tagline: form.tagline.trim(),
      icon: form.icon.trim() || '📦',
      icon_image_url: form.icon_image_url.trim(),
      cover_images: form.cover_images.filter(Boolean),
      color: form.color.trim() || '#FDDAC8',
      hero_bg_url: form.hero_bg_url.trim(),
      badge_popular_text: form.badge_popular_text.trim(),
      badge_guarantee_text: form.badge_guarantee_text.trim(),
      sold_text: form.sold_text.trim(),
      shared_note: form.shared_note.trim(),
      private_note: form.private_note.trim(),
      feature_items: normalizeStringItems(form.feature_items, 12),
      spec_items: normalizeSpecItems(form.spec_items),
      trust_badges: trustBadges,
      trust_items: deriveTrustItemsFromBadges(trustBadges),
      faq_items: normalizeFaqItems(form.faq_items),
      price_original_text: form.price_original_text.trim(),
      price_per_day_text: form.price_per_day_text.trim(),
      discount_badge_text: form.discount_badge_text.trim(),
      show_whatsapp_button: form.show_whatsapp_button,
      whatsapp_number: sanitizeWhatsAppNumber(form.whatsapp_number),
      whatsapp_button_text: form.whatsapp_button_text.trim(),
      seo_description: form.seo_description.trim(),
      fulfillment_type: form.fulfillment_type || 'credential',
      fulfillment_guide: form.fulfillment_guide.trim(),
      metadata: form.metadata,
      sort_priority: Number(form.sort_priority) || 0,
      is_popular: form.is_popular,
      is_active: form.is_active,
    }

    try {
      const productRes =
        formMode === 'create'
          ? await productService.adminCreate(payload)
          : await productService.adminUpdate(editingId as string, payload)

      if (!productRes.success) {
        setError(productRes.message || 'Gagal simpan produk')
        return
      }

      const productId = productRes.data.id

      for (const priceId of removedPriceIds) {
        const removeRes = await productService.adminDeletePrice(productId, priceId)
        if (!removeRes.success) {
          setError(removeRes.message || 'Gagal menonaktifkan harga produk')
          return
        }
      }

      for (const draft of priceDrafts) {
        const pricePayload = {
          duration: draft.duration,
          account_type: normalizeAccountTypeCode(draft.account_type),
          label: normalizePriceLabel(draft.label, draft.duration),
          savings_text: draft.savings_text.trim(),
          price: draft.price,
          is_active: draft.is_active,
        }

        if (draft.id) {
          const updateRes = await productService.adminUpdatePrice(productId, draft.id, pricePayload)
          if (!updateRes.success) {
            setError(updateRes.message || 'Gagal update harga produk')
            return
          }
          continue
        }

        const createRes = await productService.adminCreatePrice(productId, pricePayload)
        if (!createRes.success) {
          setError(createRes.message || 'Gagal membuat harga produk')
          return
        }
      }

      setFormOpen(false)
      setNotice(
        formMode === 'create'
          ? 'Produk baru berhasil dibuat dan paket harga langsung tersinkron.'
          : 'Produk dan paket harga berhasil diperbarui.'
      )
      await loadProducts()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menyimpan produk + paket harga'))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (product: Product) => {
    try {
      const res = await productService.adminUpdate(product.id, { is_active: !product.is_active })
      if (!res.success) {
        setError(res.message || 'Gagal update status produk')
        return
      }

      setNotice(
        !product.is_active
          ? `Produk "${product.name}" diaktifkan.`
          : `Produk "${product.name}" dinonaktifkan.`
      )
      await loadProducts()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengubah status produk'))
    }
  }

  const doArchiveProduct = async (product: Product) => {
    try {
      const res = await productService.adminDelete(product.id)
      if (!res.success) {
        setError(res.message || 'Gagal mengarsipkan produk')
        return
      }

      setNotice(`Produk "${product.name}" berhasil diarsipkan.`)
      await loadProducts()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal mengarsipkan produk'))
    }
  }

  const doHardDeleteProduct = async (product: Product) => {
    try {
      const res = await productService.adminDeletePermanent(product.id)
      if (!res.success) {
        setError(res.message || 'Gagal menghapus permanen produk')
        return
      }

      setNotice(`Produk "${product.name}" berhasil dihapus permanen.`)
      await loadProducts()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menghapus permanen produk'))
    }
  }

  const archiveProduct = async (product: Product) => {
    setConfirmTitle('Arsipkan Produk')
    setConfirmDescription(`Arsipkan produk "${product.name}"? Produk akan jadi nonaktif.`)
    setConfirmAction({ type: 'archive', product })
    setConfirmOpen(true)
  }

  const hardDeleteProduct = async (product: Product) => {
    setConfirmTitle('Hapus Permanen Produk')
    setConfirmDescription(
      `Hapus permanen produk "${product.name}"? Data produk, stok, dan paket harga akan dihapus. Riwayat order tetap aman (produk dengan order tidak bisa dihapus permanen).`
    )
    setConfirmAction({ type: 'hard-delete', product })
    setConfirmOpen(true)
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return

    setConfirmOpen(false)

    if (confirmAction.type === 'archive') {
      await doArchiveProduct(confirmAction.product)
      return
    }

    await doHardDeleteProduct(confirmAction.product)
  }

  const handleUploadAsset = async (kind: 'icon' | 'hero' | 'cover', file?: File) => {
    if (!file) return
    if (!editingId || formMode !== 'edit') {
      setError('Upload gambar hanya bisa setelah produk dibuat (mode edit).')
      return
    }

    try {
      setUploadingAssetKind(kind)
      setError('')

      const res = await productService.adminUploadAsset(editingId, kind, file)
      if (!res.success) {
        setError(res.message || 'Gagal upload gambar produk')
        return
      }

      const nextUrl = res.data?.url || ''
      setForm((prev) => ({
        ...prev,
        icon_image_url: kind === 'icon' ? nextUrl : prev.icon_image_url,
        hero_bg_url: kind === 'hero' ? nextUrl : prev.hero_bg_url,
      }))
      setNotice(kind === 'icon' ? 'Icon image berhasil diupload ke R2.' : 'Background hero berhasil diupload ke R2.')
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal upload gambar produk'))
    } finally {
      setUploadingAssetKind(null)
    }
  }

  const handleUploadCover = async (file?: File) => {
    if (!file) return
    if (!editingId || formMode !== 'edit') {
      setError('Upload cover hanya bisa setelah produk dibuat (mode edit).')
      return
    }
    if (form.cover_images.length >= 8) {
      setError('Maksimal 8 cover images per produk.')
      return
    }

    try {
      setUploadingCover(true)
      setError('')

      const res = await productService.adminUploadAsset(editingId, 'cover', file)
      if (!res.success) {
        setError(res.message || 'Gagal upload cover image')
        return
      }

      const nextUrl = res.data?.url || ''
      setForm((prev) => ({
        ...prev,
        cover_images: [...prev.cover_images, nextUrl],
      }))
      setNotice('Cover image berhasil diupload ke R2.')
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal upload cover image'))
    } finally {
      setUploadingCover(false)
    }
  }

  const handleRemoveCover = async (coverUrl: string) => {
    if (!editingId || formMode !== 'edit') {
      setForm((prev) => ({
        ...prev,
        cover_images: prev.cover_images.filter((url) => url !== coverUrl),
      }))
      return
    }

    try {
      const res = await productService.adminDeleteCoverAsset(editingId, coverUrl)
      if (!res.success) {
        setError(res.message || 'Gagal menghapus cover image')
        return
      }
      setForm((prev) => ({
        ...prev,
        cover_images: prev.cover_images.filter((url) => url !== coverUrl),
      }))
      setNotice('Cover image berhasil dihapus.')
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menghapus cover image'))
    }
  }

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar mb-3">
          ✅ <strong>{notice}</strong>
          <button className="link-btn" style={{ marginLeft: 'auto', color: 'inherit' }} onClick={() => setNotice('')}>
            tutup
          </button>
        </div>
      )}

      {!!error && (
        <div
          className="alert-bar"
          style={{ marginBottom: 12, background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}
        >
          ⚠️ <strong>{error}</strong>
        </div>
      )}

      <AdminDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button className="bg-[#ff5733] text-white hover:bg-[#e84b2b]" onClick={handleConfirmAction}>Lanjut</Button>
          </>
        }
      />

      <div className="grid gap-4">
        <AdminPageHeader
          eyebrow="Admin Catalog"
          title="Produk DigiProduct"
          description="Kelola katalog, harga, fulfillment, dan status produk digital dari satu workspace yang lebih jelas."
          actions={
            <Button className="h-10 rounded-full bg-[#ff5733] px-5 text-sm font-black text-white hover:bg-[#e84b2b]" onClick={openCreate}>
              + Tambah Produk
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Total Produk" value={productStats.total} detail={`${filteredProducts.length} tampil setelah filter`} tone="neutral" />
          <AdminStatCard label="Produk Aktif" value={productStats.active} detail={`${productStats.inactive} nonaktif / arsip`} tone="green" />
          <AdminStatCard label="Populer" value={productStats.popular} detail="Ditandai sebagai highlight katalog" tone="orange" />
          <AdminStatCard label="Kategori" value={productStats.categories} detail={`${productStats.withPrices} produk punya harga aktif`} tone="neutral" />
        </div>

        <AdminFilterBar>
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_180px_auto] lg:items-center">
            <div className="contents">
            <Input
              type="text"
              className="min-h-11 rounded-2xl border-neutral-200 bg-neutral-50/70 px-4 text-sm font-semibold"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, slug, kategori, atau deskripsi..."
            />

            <select
              className="form-select min-h-11 rounded-2xl border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Semua Kategori</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="form-select min-h-11 rounded-2xl border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            <Button className="h-11 rounded-2xl bg-neutral-950 px-4 font-black text-white hover:bg-neutral-800" onClick={openCreate}>
              Produk Baru
            </Button>
            </div>
          </div>
        </AdminFilterBar>

        <div className="admin-desktop-only">

        <AdminSurface className="overflow-hidden p-0">
          <div className="table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Harga Mulai</TableHead>
                  <TableHead>Paket</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Popular</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} style={{ textAlign: 'center', color: '#6B7280', padding: 28 }}>
                      Memuat data produk...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} style={{ textAlign: 'center', color: '#6B7280', padding: 28 }}>
                      Tidak ada produk yang cocok dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const minPrice = getLowestPrice(product)

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span style={{ fontSize: 22 }}>{product.icon || '📦'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{product.name}</div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>/{product.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="product-pill">{getCategoryLabel(product.category, categoryOptions)}</span>
                        </TableCell>
                        <TableCell style={{ fontWeight: 600 }}>{minPrice ? formatRupiah(minPrice) : '-'}</TableCell>
                        <TableCell style={{ fontSize: 12, color: '#6B7280' }}>{summarizePrices(product.prices, accountTypeMap)}</TableCell>
                        <TableCell style={{ fontWeight: 600, fontSize: 12 }}>{product.sort_priority || 0}</TableCell>
                        <TableCell>
                          <AdminStatusPill tone={product.is_popular ? 'green' : 'neutral'}>{product.is_popular ? 'Populer' : 'Normal'}</AdminStatusPill>
                        </TableCell>
                        <TableCell>
                          <AdminStatusPill tone={product.is_active ? 'green' : 'red'}>{product.is_active ? 'Aktif' : 'Nonaktif'}</AdminStatusPill>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1.5 flex-wrap">
                            <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition" onClick={() => openEdit(product)}>
                              ✏ Edit
                            </button>
                            <button className={`action-btn${product.is_active ? '' : ' orange'}`} onClick={() => toggleActive(product)}>
                              {product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition"
                              style={{ color: '#EF4444', borderColor: '#FECACA' }}
                              onClick={() => archiveProduct(product)}
                            >
                              Arsipkan
                            </button>
                            <button
                              className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition"
                              style={{ color: '#991B1B', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                              onClick={() => hardDeleteProduct(product)}
                            >
                              Hapus Permanen
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </AdminSurface>
      </div>

      <div className="admin-mobile-only">
        <div className="hidden">
          <div>
            <div className="mobile-page-title">Produk</div>
            <div className="mobile-page-subtitle">Kontrol produk + paket harga DigiProduct</div>
          </div>
          <button className="mobile-chip-btn primary" onClick={openCreate}>
            + Baru
          </button>
        </div>

        <div className="hidden">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="min-h-11 rounded-2xl border-neutral-200 bg-neutral-50/70 px-4 text-sm font-semibold"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama / slug produk"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <select className="min-h-11 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold w-full" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Semua Kategori</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select className="min-h-11 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
        </div>

        <AdminMobileCardList
          items={filteredProducts}
          loading={loading}
          emptyTitle="Tidak ada produk"
          emptyDescription="Tidak ada produk untuk filter saat ini."
          renderItem={(product) => {
            const minPrice = getLowestPrice(product)
            return (<>
                <div className="mobile-card-head">
                  <div><div className="mobile-card-title">{product.icon || '📦'} {product.name}</div><div className="mobile-card-sub">/{product.slug}</div></div>
                  <AdminStatusPill tone={product.is_active ? 'green' : 'red'}>{product.is_active ? 'Aktif' : 'Nonaktif'}</AdminStatusPill>
                </div>
                <div className="mobile-card-row"><span className="mobile-card-label">Kategori</span><span className="mobile-card-value">{getCategoryLabel(product.category, categoryOptions)}</span></div>
                <div className="mobile-card-row"><span className="mobile-card-label">Harga mulai</span><span className="mobile-card-value">{minPrice ? formatRupiah(minPrice) : '-'}</span></div>
                <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}><span className="mobile-card-label">Paket</span><span className="mobile-card-value" style={{ maxWidth: '68%' }}>{summarizePrices(product.prices, accountTypeMap)}</span></div>
                <div className="mobile-card-row"><span className="mobile-card-label">Priority</span><span className="mobile-card-value">{product.sort_priority || 0}</span></div>
                <div className="mobile-card-row"><span className="mobile-card-label">Flag</span><span className="mobile-card-value">{product.is_popular ? 'Populer' : 'Normal'}</span></div>
                <div className="mobile-card-actions">
                  <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition" onClick={() => openEdit(product)}>Edit</button>
                  <button className={`action-btn${product.is_active ? '' : ' orange'}`} onClick={() => toggleActive(product)}>{product.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => archiveProduct(product)}>Arsip</button>
                  <button className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition" style={{ color: '#991B1B', borderColor: '#FCA5A5', background: '#FEF2F2' }} onClick={() => hardDeleteProduct(product)}>Hapus</button>
                </div>
              </>)
          }}
        />

        <button className="mobile-fab" onClick={openCreate}>
          + Produk
        </button>
      </div>

      </div>

      <AdminDialog
        open={typeSelectOpen}
        onOpenChange={setTypeSelectOpen}
        title="Pilih Tipe Produk"
        description="Pilih jenis produk yang ingin ditambahkan. Form akan disesuaikan otomatis."
        footer={null}
      >
        <div className="grid grid-cols-2 gap-3 p-1">
          {PRODUCT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectProductType(opt.value)}
              className="flex flex-col items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:border-[#ff5733] hover:shadow-sm"
            >
              <span className="text-2xl">{opt.icon}</span>
              <div>
                <div className="text-sm font-bold text-neutral-900">{opt.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </AdminDialog>

      <AdminDialog
        open={formOpen}
        onOpenChange={(open) => { if (!open) closeForm() }}
        title={formMode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk + Konten + Harga'}
        description="Kelola produk digital, konten, dan paket harga."

        className="sm:max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={saving}>Batal</Button>
            <Button className="bg-[#ff5733] text-white hover:bg-[#e84b2b]" onClick={submitForm} disabled={saving}>
              {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Produk' : 'Update Produk'}
            </Button>
          </>
        }
      >

        <div style={{ padding: '4px 0', display: 'grid', gap: 16 }}>
          {/* ===== SECTION 1: INFORMASI DASAR ===== */}
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#141414' }}>1. Informasi Dasar</div>

            <div>
              <label className="form-label">Nama Produk</label>
              <Input value={form.name}
                onChange={(event) => { const n = event.target.value; setForm((prev) => ({ ...prev, name: n, slug: !slugTouched ? slugify(n) : prev.slug })) }}
                placeholder="Contoh: Netflix Premium 1 Bulan" />
            </div>

            <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 10 }}>
              <div>
                <label className="form-label">Slug URL</label>
                <Input value={form.slug}
                  onChange={(event) => { setSlugTouched(true); setForm((prev) => ({ ...prev, slug: slugify(event.target.value) })) }}
                  placeholder="netflix-premium" />
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>/product/digiproduct/{form.slug || 'slug-produk'}</div>
              </div>
              <div>
                <label className="form-label">Kategori</label>
                <select className="min-h-11 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold w-full"
                  value={form.category}
                  onChange={(event) => { const cat = event.target.value; const tmpl = CATEGORY_TEMPLATES[cat]; setForm((prev) => ({ ...prev, category: cat, fulfillment_type: tmpl ? tmpl.defaultFulfillment : prev.fulfillment_type })) }}>
                  {formCategoryOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 10 }}>
              <div>
                <label className="form-label">Tipe Produk</label>
                {formMode === 'create' ? (
                  (() => {
                    const sel = PRODUCT_TYPE_OPTIONS.find((o) => o.value === form.metadata?.product_type)
                    return (
                      <div className="flex items-center gap-2.5 min-h-11 rounded-2xl border border-neutral-200 bg-neutral-100/70 px-4">
                        <span className="text-lg">{sel?.icon || '📦'}</span>
                        <div>
                          <div className="text-sm font-bold text-neutral-900">{sel?.label || 'Tidak dipilih'}</div>
                          {sel && <div className="text-xs text-neutral-500">{sel.desc}</div>}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <select className="min-h-11 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 text-sm font-bold w-full"
                    value={(form.metadata?.product_type as string) || ''}
                    onChange={(event) => { const type = event.target.value; const opt = PRODUCT_TYPE_OPTIONS.find((o) => o.value === type); if (opt) { setForm((prev) => ({ ...prev, category: opt.defaultCategory, fulfillment_type: opt.defaultFulfillment as Product['fulfillment_type'], metadata: { ...createDefaultMetadataForType(type), ...prev.metadata, product_type: type } })) } }}>
                    <option value="">-- Pilih Tipe Produk --</option>
                    {PRODUCT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="form-label">Icon Emoji</label>
                <Input value={form.icon} onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))} placeholder="🎬" />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="form-label">Deskripsi Singkat</label>
              <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={3}
                value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsikan produk dalam 1-2 kalimat" />
            </div>
          </div>

          {/* ===== SECTION 2: DETAIL PER TIPE ===== */}
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            {(() => {
              const detailConfig = PRODUCT_TYPE_DETAIL_CONFIG[(form.metadata?.product_type as string) || '']
              return (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#141414' }}>2. {detailConfig?.title || 'Detail Produk'}</div>
                  {detailConfig && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>{detailConfig.description}</div>}
                </>
              )
            })()}

            {/* Tipe: Akun Premium */}
            {form.metadata?.product_type === 'subscription' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="form-label">Tipe Fulfillment (auto)</label>
                  <Input value={PRODUCT_TYPE_DETAIL_CONFIG.subscription.fulfillmentLabel} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="form-label">Jenis Akses Utama</label>
                    <Input value={(form.metadata?.access_type as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, access_type: e.target.value } }))}
                      placeholder="Contoh: Shared, Private, Family" />
                  </div>
                  <div>
                    <label className="form-label">Format Credential</label>
                    <Input value={(form.metadata?.credential_format as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, credential_format: e.target.value } }))}
                      placeholder="Contoh: Email + password + profil" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="form-label">Catatan Akun Shared</label>
                    <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                      value={form.shared_note} onChange={(e) => setForm((prev) => ({ ...prev, shared_note: e.target.value }))}
                      placeholder="Contoh: Akun dipakai bersama, 1 profil aktif" />
                  </div>
                  <div>
                    <label className="form-label">Catatan Akun Private</label>
                    <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                      value={form.private_note} onChange={(e) => setForm((prev) => ({ ...prev, private_note: e.target.value }))}
                      placeholder="Contoh: Akses penuh, ganti password bebas" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Garansi Akun</label>
                  <Input value={(form.metadata?.account_warranty as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, account_warranty: e.target.value } }))}
                    placeholder="Contoh: Garansi replace selama masa aktif" />
                </div>
                <div>
                  <label className="form-label">Panduan / Instruksi (opsional)</label>
                  <Textarea className="min-h-[60px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={form.fulfillment_guide} onChange={(e) => setForm((prev) => ({ ...prev, fulfillment_guide: e.target.value }))}
                    placeholder="Langkah setelah pembeli dapat akun..." />
                </div>
              </div>
            )}

            {/* Tipe: Akun Game */}
            {form.metadata?.product_type === 'game' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="form-label">Tipe Fulfillment (auto)</label>
                  <Input value={PRODUCT_TYPE_DETAIL_CONFIG.game.fulfillmentLabel} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="form-label">Platform / Server</label>
                    <Input value={(form.metadata?.platform as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, platform: e.target.value } }))}
                      placeholder="Contoh: Steam, Mobile Legends, Garena" />
                  </div>
                  <div>
                    <label className="form-label">Region</label>
                    <Input value={(form.metadata?.region as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, region: e.target.value } }))}
                      placeholder="Contoh: Indonesia, Global, SEA" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Requirement Login / Info Game</label>
                  <Textarea className="min-h-[60px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={(form.metadata?.game_info as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, game_info: e.target.value } }))}
                    placeholder="Contoh: Butuh login via Google, wajib ada akun game level 10+" />
                </div>
                <div>
                  <label className="form-label">Info Keamanan Akun</label>
                  <Textarea className="min-h-[60px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={(form.metadata?.account_security as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, account_security: e.target.value } }))}
                    placeholder="Contoh: Jangan ubah email/password tanpa konfirmasi CS" />
                </div>
                <div>
                  <label className="form-label">Panduan Delivery</label>
                  <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={form.fulfillment_guide} onChange={(e) => setForm((prev) => ({ ...prev, fulfillment_guide: e.target.value }))}
                    placeholder="Langkah pengiriman ke buyer setelah pembayaran..." />
                </div>
              </div>
            )}

            {/* Tipe: Lisensi / Key */}
            {form.metadata?.product_type === 'license' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="form-label">Tipe Fulfillment (auto)</label>
                  <Input value={PRODUCT_TYPE_DETAIL_CONFIG.license.fulfillmentLabel} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="form-label">Jenis Lisensi</label>
                    <Input value={(form.metadata?.license_type as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, license_type: e.target.value } }))}
                      placeholder="Lifetime, subscription, trial" />
                  </div>
                  <div>
                    <label className="form-label">Jumlah Device</label>
                    <Input value={(form.metadata?.device_limit as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, device_limit: e.target.value } }))}
                      placeholder="Contoh: 1 device" />
                  </div>
                  <div>
                    <label className="form-label">Masa Berlaku</label>
                    <Input value={(form.metadata?.license_expiry as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, license_expiry: e.target.value } }))}
                      placeholder="Contoh: 1 tahun" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Informasi Lisensi</label>
                  <Textarea className="min-h-[60px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={(form.metadata?.license_info as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, license_info: e.target.value } }))}
                    placeholder="Contoh: Lisensi permanen, 1 device, support update gratis" />
                </div>
                <div>
                  <label className="form-label">Panduan Delivery</label>
                  <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={form.fulfillment_guide} onChange={(e) => setForm((prev) => ({ ...prev, fulfillment_guide: e.target.value }))}
                    placeholder="Cara redeem / aktivasi kode lisensi..." />
                </div>
              </div>
            )}

            {/* Tipe: Voucher / Digital */}
            {form.metadata?.product_type === 'digital' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label className="form-label">Tipe Fulfillment (auto)</label>
                  <Input value={PRODUCT_TYPE_DETAIL_CONFIG.digital.fulfillmentLabel} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="form-label">Jenis Digital</label>
                    <Input value={(form.metadata?.digital_type as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, digital_type: e.target.value } }))}
                      placeholder="Gift card, voucher, file, template" />
                  </div>
                  <div>
                    <label className="form-label">Nominal / Paket</label>
                    <Input value={(form.metadata?.voucher_value as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, voucher_value: e.target.value } }))}
                      placeholder="Contoh: IDR 50.000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="form-label">Region</label>
                    <Input value={(form.metadata?.region as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, region: e.target.value } }))}
                      placeholder="Contoh: Indonesia" />
                  </div>
                  <div>
                    <label className="form-label">Masa Berlaku</label>
                    <Input value={(form.metadata?.voucher_expiry as string) || ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, voucher_expiry: e.target.value } }))}
                      placeholder="Contoh: Berlaku 12 bulan" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Info Voucher / Digital</label>
                  <Textarea className="min-h-[60px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={(form.metadata?.voucher_info as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, voucher_info: e.target.value } }))}
                    placeholder="Contoh: Gift card Google Play IDR 50.000, berlaku 1 tahun" />
                </div>
                <div>
                  <label className="form-label">Link Download / Redeem</label>
                  <Input value={(form.metadata?.download_link as string) || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, metadata: { ...prev.metadata, download_link: e.target.value } }))}
                    placeholder="https://..." />
                </div>
                <div>
                  <label className="form-label">Panduan Delivery</label>
                  <Textarea className="min-h-[80px] rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-sm font-medium resize-y w-full" rows={2}
                    value={form.fulfillment_guide} onChange={(e) => setForm((prev) => ({ ...prev, fulfillment_guide: e.target.value }))}
                    placeholder="Cara klaim / redeem voucher..." />
                </div>
              </div>
            )}

            {/* Belum pilih tipe */}
            {!form.metadata?.product_type && (
              <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                Pilih <strong>Tipe Produk</strong> di atas untuk melihat form detail yang sesuai.
              </div>
            )}
          </div>

          {/* ===== SECTION 3: TAMPILAN & MARKETING (collapsible) ===== */}
          <details style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <summary style={{ padding: '12px 16px', background: '#FAFAFA', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#141414', userSelect: 'none' }}>
              3. Tampilan & Marketing (Opsional)
            </summary>
            <div style={{ padding: '14px 16px', display: 'grid', gap: 10, background: '#fff' }}>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="form-label">Warna Kartu</label>
                  <Input value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} placeholder="#FDDAC8" />
                </div>
                <div>
                  <label className="form-label">Sort Priority</label>
                  <Input type="number" value={form.sort_priority} onChange={(e) => setForm((prev) => ({ ...prev, sort_priority: Number(e.target.value) || 0 }))} placeholder="0" />
                </div>
              </div>

              <div>
                <label className="form-label">Tagline Header</label>
                <Input value={form.tagline} onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))} placeholder="Shared 4K Ultra HD · 1 profil aktif" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="form-label">Badge Populer</label>
                  <Input value={form.badge_popular_text} onChange={(e) => setForm((prev) => ({ ...prev, badge_popular_text: e.target.value }))} placeholder="🔥 Terlaris" />
                </div>
                <div>
                  <label className="form-label">Badge Garansi</label>
                  <Input value={form.badge_guarantee_text} onChange={(e) => setForm((prev) => ({ ...prev, badge_guarantee_text: e.target.value }))} placeholder="🛡 Garansi 30 Hari" />
                </div>
              </div>

              <div>
                <label className="form-label">Teks Highlight / Sold</label>
                <Input value={form.sold_text} onChange={(e) => setForm((prev) => ({ ...prev, sold_text: e.target.value }))} placeholder="🛒 5.800+ terjual bulan ini" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div><label className="form-label">Harga Coret</label><Input value={form.price_original_text} onChange={(e) => setForm((prev) => ({ ...prev, price_original_text: e.target.value }))} placeholder="Rp 54.000" /></div>
                <div><label className="form-label">Harga /Hari</label><Input value={form.price_per_day_text} onChange={(e) => setForm((prev) => ({ ...prev, price_per_day_text: e.target.value }))} placeholder="≈ Rp 1.300/hari" /></div>
                <div><label className="form-label">Badge Diskon</label><Input value={form.discount_badge_text} onChange={(e) => setForm((prev) => ({ ...prev, discount_badge_text: e.target.value }))} placeholder="hemat 25%" /></div>
              </div>

              {/* Icon Image */}
              <div>
                <label className="form-label">Icon Image URL (R2)</label>
                <Input value={form.icon_image_url} onChange={(e) => setForm((prev) => ({ ...prev, icon_image_url: e.target.value }))} placeholder="https://..." />
                {formMode === 'edit' && <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleUploadAsset('icon', e.target.files?.[0])} disabled={uploadingAssetKind === 'icon'} style={{ marginTop: 8, fontSize: 12 }} />}
                <div style={{ marginTop: 4, fontSize: 11, color: '#6B7280' }}>Rasio 1:1, min 256x256.</div>
              </div>

              {/* Hero */}
              <div>
                <label className="form-label">Hero Background URL (R2)</label>
                <Input value={form.hero_bg_url} onChange={(e) => setForm((prev) => ({ ...prev, hero_bg_url: e.target.value }))} placeholder="https://..." />
                {formMode === 'edit' && <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleUploadAsset('hero', e.target.files?.[0])} disabled={uploadingAssetKind === 'hero'} style={{ marginTop: 8, fontSize: 12 }} />}
                <div style={{ marginTop: 4, fontSize: 11, color: '#6B7280' }}>Rasio 16:9, min 1280x720.</div>
              </div>

              {/* Cover */}
              <div>
                <div className="flex justify-between items-center"><label className="form-label">Cover Images (Carousel)</label>
                  {formMode === 'edit' && <label className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold cursor-pointer" style={{ opacity: uploadingCover ? 0.5 : 1 }}>{uploadingCover ? 'Uploading...' : '+ Upload'}<input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => void handleUploadCover(e.target.files?.[0])} disabled={uploadingCover} /></label>}
                </div>
                {form.cover_images.length === 0 ? <div style={{ border: '1px dashed #E5E7EB', borderRadius: 10, padding: 12, fontSize: 12, color: '#6B7280' }}>Belum ada cover.</div> :
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
                    {form.cover_images.map((url, i) => (
                      <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ aspectRatio: '4/3', background: '#F7F7F5' }}><img src={url} alt={`Cover ${i+1}`} style={{ objectFit: 'contain', padding: 6, width: '100%', height: '100%' }} /></div>
                        <button type="button" style={{ width: '100%', fontSize: 10, padding: '4px 0', color: '#EF4444', border: 'none', background: '#FEF2F2' }} onClick={() => handleRemoveCover(url)}>Hapus</button>
                      </div>))}
                  </div>}
              </div>

              {/* Fitur */}
              <div>
                <div className="flex justify-between items-center"><label className="form-label">Fitur Produk</label><button className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" onClick={addFeatureItem}>+ Fitur</button></div>
                <div className="grid gap-2" style={{ marginTop: 6 }}>
                  {form.feature_items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                      <Input value={item} onChange={(e) => updateFeatureItem(i, e.target.value)} placeholder={`Fitur ${i+1}`} />
                      <button className="inline-flex h-9 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => removeFeatureItem(i)} disabled={form.feature_items.length <= 1}>Hapus</button>
                    </div>))}
                </div>
              </div>

              {/* Spesifikasi */}
              <div>
                <div className="flex justify-between items-center"><label className="form-label">Spesifikasi</label><button className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" onClick={addSpecItem}>+ Spek</button></div>
                <div className="grid gap-2" style={{ marginTop: 6 }}>
                  {form.spec_items.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                      <Input value={item.label} onChange={(e) => updateSpecItem(i, { label: e.target.value })} placeholder="Label" />
                      <Input value={item.value} onChange={(e) => updateSpecItem(i, { value: e.target.value })} placeholder="Nilai" />
                      <button className="inline-flex h-9 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => removeSpecItem(i)} disabled={form.spec_items.length <= 1}>Hapus</button>
                    </div>))}
                </div>
              </div>

              {/* Trust */}
              <div>
                <div className="flex justify-between items-center"><label className="form-label">Trust Chips</label><button className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" onClick={addTrustBadge}>+ Trust</button></div>
                <div className="grid gap-2" style={{ marginTop: 6 }}>
                  {form.trust_badges.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 6 }}>
                      <Input value={item.icon} onChange={(e) => updateTrustBadge(i, { icon: e.target.value })} placeholder="✨" />
                      <Input value={item.text} onChange={(e) => updateTrustBadge(i, { text: e.target.value })} placeholder="Garansi 30 Hari" />
                      <button className="inline-flex h-9 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => removeTrustBadge(i)} disabled={form.trust_badges.length <= 1}>Hapus</button>
                    </div>))}
                </div>
              </div>

              {/* FAQ */}
              <div>
                <div className="flex justify-between items-center"><label className="form-label">FAQ</label><button className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" onClick={addFaqItem}>+ FAQ</button></div>
                <div className="grid gap-2" style={{ marginTop: 6 }}>
                  {form.faq_items.map((item, i) => (
                    <div key={i} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
                      <Input value={item.question} onChange={(e) => updateFaqItem(i, { question: e.target.value })} placeholder={`Pertanyaan ${i+1}`} />
                      <Textarea className="min-h-[60px] rounded-xl border px-3 py-2 text-sm resize-y w-full" rows={2} value={item.answer} onChange={(e) => updateFaqItem(i, { answer: e.target.value })} placeholder="Jawaban" />
                      <div className="flex justify-end"><button className="inline-flex h-8 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => removeFaqItem(i)} disabled={form.faq_items.length <= 1}>Hapus</button></div>
                    </div>))}
                </div>
              </div>

              {/* WhatsApp */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 8, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><input type="checkbox" checked={form.show_whatsapp_button} onChange={(e) => setForm((prev) => ({ ...prev, show_whatsapp_button: e.target.checked }))} /> WA</label>
                <div><label className="form-label">No WA</label><Input value={form.whatsapp_number} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_number: sanitizeWhatsAppNumber(e.target.value) }))} placeholder="62812xxxx" /></div>
                <div><label className="form-label">Label WA</label><Input value={form.whatsapp_button_text} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp_button_text: e.target.value }))} placeholder="Tanya via WhatsApp" /></div>
              </div>

              {/* SEO */}
              <div>
                <label className="form-label">Meta SEO</label>
                <Textarea className="min-h-[60px] rounded-xl border px-3 py-2 text-sm resize-y w-full" rows={2} value={form.seo_description} onChange={(e) => setForm((prev) => ({ ...prev, seo_description: e.target.value }))} placeholder="Deskripsi SEO" />
              </div>
            </div>
          </details>

          {/* ===== SECTION 4: PAKET HARGA ===== */}
          <div style={{ padding: 14, borderRadius: 12, border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#141414' }}>4. Paket Harga</div>

            <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 8 }}>
              {activeAccountTypeOptions.map((option) => (
                <button key={option.value} className="inline-flex h-9 items-center rounded-xl border bg-white px-4 text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition" type="button" onClick={() => addPriceRow(option.value)}>
                  + Paket {option.label}
                </button>))}
            </div>

            <div className="grid gap-2">
              {priceDrafts.length === 0 ? (
                <div style={{ border: '1px dashed #E5E7EB', borderRadius: 10, padding: 12, fontSize: 12, color: '#6B7280' }}>Belum ada paket harga.</div>
              ) : priceDrafts.map((row) => (
                <div key={row.local_id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label className="form-label">Tipe</label>
                      <select className="min-h-11 rounded-2xl border bg-neutral-50/70 px-4 text-sm font-bold w-full"
                        value={normalizeAccountTypeCode(row.account_type)}
                        onChange={(e) => updatePriceRow(row.local_id, { account_type: e.target.value })}>
                        {activeAccountTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Durasi (bulan)</label>
                      <Input type="number" value={row.duration} onChange={(e) => updatePriceRow(row.local_id, { duration: Number(e.target.value) || 1 })} min={1} />
                    </div>
                    <div>
                      <label className="form-label">Harga (Rp)</label>
                      <Input type="number" value={row.price} onChange={(e) => updatePriceRow(row.local_id, { price: Number(e.target.value) || 0 })} min={100} />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <div><label className="form-label">Label (opsional)</label><Input value={row.label} onChange={(e) => updatePriceRow(row.local_id, { label: e.target.value })} placeholder="Paling hemat" /></div>
                    <div><label className="form-label">Hemat (opsional)</label><Input value={row.savings_text} onChange={(e) => updatePriceRow(row.local_id, { savings_text: e.target.value })} placeholder="Hemat 30%" /></div>
                    <div className="flex items-end"><button className="inline-flex h-9 items-center rounded-lg border px-3 text-[11px] font-bold" type="button" style={{ color: '#EF4444', borderColor: '#FECACA' }} onClick={() => removePriceRow(row.local_id)}>Hapus</button></div>
                  </div>
                </div>))}
            </div>
          </div>

          {/* ===== SECTION 5: STATUS ===== */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm((prev) => ({ ...prev, is_popular: e.target.checked }))} />
              Tandai Populer
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
              Aktif
            </label>
          </div>
        </div>

</AdminDialog>

    </div>
  )
}
