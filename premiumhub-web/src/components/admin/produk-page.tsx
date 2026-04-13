"use client"

import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'

import { productService } from '@/services/productService'
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
  color: string
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

const CATEGORY_OPTIONS = [
  { value: 'streaming', label: 'Streaming' },
  { value: 'music', label: 'Musik' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'design', label: 'Desain' },
  { value: 'productivity', label: 'Produktivitas' },
]

const ACCOUNT_TYPE_OPTIONS: Array<{ value: ProductPrice['account_type']; label: string }> = [
  { value: 'shared', label: 'Shared' },
  { value: 'private', label: 'Private' },
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
    color: '#FDDAC8',
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

function getCategoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value
}

function summarizePrices(prices: ProductPrice[]) {
  if (!prices || prices.length === 0) return 'Belum ada paket'

  const active = prices.filter((p) => p.is_active)
  const source = active.length > 0 ? active : prices

  const byType = source.reduce<Record<string, number>>((acc, price) => {
    acc[price.account_type] = (acc[price.account_type] || 0) + 1
    return acc
  }, {})

  return Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, total]) => `${type} ${total}`)
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(createDefaultForm())
  const [slugTouched, setSlugTouched] = useState(false)

  const [priceDrafts, setPriceDrafts] = useState<ProductPriceDraft[]>([])
  const [removedPriceIds, setRemovedPriceIds] = useState<string[]>([])

  const loadProducts = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await productService.adminList({ page: 1, limit: 200 })
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
    void loadProducts()
  }, [])

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

  const openCreate = () => {
    setFormMode('create')
    setEditingId(null)
    setSlugTouched(false)
    setForm(createDefaultForm())
    setPriceDrafts([
      createPriceDraft({ account_type: 'shared', duration: 1, price: 25000 }),
      createPriceDraft({ account_type: 'private', duration: 1, price: 50000 }),
    ])
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
      color: product.color || '#FDDAC8',
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
      sort_priority: product.sort_priority || 0,
      is_popular: product.is_popular,
      is_active: product.is_active,
    })

    setPriceDrafts(
      product.prices?.length
        ? normalizePriceDrafts(product.prices)
        : [
            createPriceDraft({ account_type: 'shared', duration: 1, price: 25000 }),
            createPriceDraft({ account_type: 'private', duration: 1, price: 50000 }),
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
    setPriceDrafts((prev) => [...prev, createPriceDraft({ account_type: type })])
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
      return 'Minimal harus ada 1 paket harga aktif untuk produk prem-apps.'
    }

    const seen = new Set<string>()
    for (const row of priceDrafts) {
      if (row.duration < 1) return 'Durasi paket harga minimal 1 bulan.'
      if (row.price < 1) return 'Nominal harga paket tidak boleh nol.'

      const signature = `${row.account_type}:${row.duration}`
      if (seen.has(signature)) {
        return `Duplikasi paket terdeteksi (${row.account_type} ${row.duration} bulan).`
      }
      seen.add(signature)
    }

    return ''
  }

  const submitForm = async () => {
    if (!form.name.trim()) {
      setError('Nama produk wajib diisi')
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
      color: form.color.trim() || '#FDDAC8',
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
          account_type: draft.account_type,
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

  const archiveProduct = async (product: Product) => {
    const ok = window.confirm(`Arsipkan produk "${product.name}"? Produk akan jadi nonaktif.`)
    if (!ok) return

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

  const hardDeleteProduct = async (product: Product) => {
    const ok = window.confirm(
      `Hapus permanen produk "${product.name}"?\n\nData produk, stok, dan paket harga akan dihapus.\nRiwayat order tetap aman (produk dengan order tidak bisa dihapus permanen).`
    )
    if (!ok) return

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

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar" style={{ marginBottom: 12 }}>
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

      <div className="admin-desktop-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔍 Cari nama/slug produk..."
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none', width: 260 }}
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}
            >
              <option value="all">Semua Kategori</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          <button className="topbar-btn primary" onClick={openCreate}>
            + Tambah Produk Baru
          </button>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Harga Mulai</th>
                  <th>Paket</th>
                  <th>Priority</th>
                  <th>Popular</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat data produk...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Tidak ada produk yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const minPrice = getLowestPrice(product)

                    return (
                      <tr key={product.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{product.icon || '📦'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{product.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>/{product.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="product-pill">{getCategoryLabel(product.category)}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{minPrice ? formatRupiah(minPrice) : '-'}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{summarizePrices(product.prices)}</td>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{product.sort_priority || 0}</td>
                        <td>
                          <span className={`status-badge ${product.is_popular ? 's-lunas' : 's-pending'}`}>
                            {product.is_popular ? 'Populer' : 'Normal'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${product.is_active ? 's-lunas' : 's-gagal'}`}>
                            {product.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => openEdit(product)}>
                              ✏ Edit
                            </button>
                            <button className={`action-btn${product.is_active ? '' : ' orange'}`} onClick={() => toggleActive(product)}>
                              {product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              className="action-btn"
                              style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                              onClick={() => archiveProduct(product)}
                            >
                              Arsipkan
                            </button>
                            <button
                              className="action-btn"
                              style={{ color: '#991B1B', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                              onClick={() => hardDeleteProduct(product)}
                            >
                              Hapus Permanen
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
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Produk</div>
            <div className="mobile-page-subtitle">Kontrol produk + paket harga prem-apps</div>
          </div>
          <button className="mobile-chip-btn primary" onClick={openCreate}>
            + Baru
          </button>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama / slug produk"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Semua Kategori</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Memuat data produk...</div>
            </article>
          ) : filteredProducts.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada produk untuk filter saat ini.</div>
            </article>
          ) : (
            filteredProducts.map((product) => {
              const minPrice = getLowestPrice(product)

              return (
                <article className="mobile-card" key={product.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">
                        {product.icon || '📦'} {product.name}
                      </div>
                      <div className="mobile-card-sub">/{product.slug}</div>
                    </div>
                    <span className={`status-badge ${product.is_active ? 's-lunas' : 's-gagal'}`}>
                      {product.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Kategori</span>
                    <span className="mobile-card-value">{getCategoryLabel(product.category)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Harga mulai</span>
                    <span className="mobile-card-value">{minPrice ? formatRupiah(minPrice) : '-'}</span>
                  </div>
                  <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                    <span className="mobile-card-label">Paket</span>
                    <span className="mobile-card-value" style={{ maxWidth: '68%' }}>
                      {summarizePrices(product.prices)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Priority</span>
                    <span className="mobile-card-value">{product.sort_priority || 0}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Flag</span>
                    <span className="mobile-card-value">{product.is_popular ? 'Populer' : 'Normal'}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => openEdit(product)}>
                      Edit
                    </button>
                    <button className={`action-btn${product.is_active ? '' : ' orange'}`} onClick={() => toggleActive(product)}>
                      {product.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      className="action-btn"
                      style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                      onClick={() => archiveProduct(product)}
                    >
                      Arsip
                    </button>
                    <button
                      className="action-btn"
                      style={{ color: '#991B1B', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                      onClick={() => hardDeleteProduct(product)}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <button className="mobile-fab" onClick={openCreate}>
          + Produk
        </button>
      </div>

      {formOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,20,.35)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="card-header">
              <h2>{formMode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk + Konten + Harga'}</h2>
              <button className="action-btn" onClick={closeForm} disabled={saving}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              <div>
                <label className="form-label">Nama Produk</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(event) => {
                    const nextName = event.target.value
                    setForm((prev) => ({
                      ...prev,
                      name: nextName,
                      slug: !slugTouched ? slugify(nextName) : prev.slug,
                    }))
                  }}
                  placeholder="Contoh: Netflix Premium"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Slug URL</label>
                  <input
                    className="form-input"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true)
                      setForm((prev) => ({
                        ...prev,
                        slug: slugify(event.target.value),
                      }))
                    }}
                    placeholder="contoh: netflix-premium"
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    URL publik: /product/prem-apps/{form.slug || 'slug-produk'}
                  </div>
                </div>

                <div>
                  <label className="form-label">Kategori</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Icon</label>
                  <input
                    className="form-input"
                    value={form.icon}
                    onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                    placeholder="🎬"
                  />
                </div>
                <div>
                  <label className="form-label">Warna Kartu</label>
                  <input
                    className="form-input"
                    value={form.color}
                    onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
                    placeholder="#FDDAC8"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Deskripsi</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Deskripsi singkat produk"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Fitur Produk (Checklist)
                  </label>
                  <button className="action-btn" type="button" onClick={addFeatureItem}>
                    + Tambah Fitur
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {form.feature_items.map((item, index) => (
                    <div key={`feature-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                      <input
                        className="form-input"
                        value={item}
                        onChange={(event) => updateFeatureItem(index, event.target.value)}
                        placeholder={`Fitur ${index + 1}`}
                      />
                      <button
                        className="action-btn"
                        type="button"
                        style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                        onClick={() => removeFeatureItem(index)}
                        disabled={form.feature_items.length <= 1}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Tagline Header</label>
                  <input
                    className="form-input"
                    value={form.tagline}
                    onChange={(event) => setForm((prev) => ({ ...prev, tagline: event.target.value }))}
                    placeholder="Shared 4K Ultra HD · 1 profil aktif"
                  />
                </div>
                <div>
                  <label className="form-label">Sort Priority</label>
                  <input
                    className="form-input"
                    type="number"
                    value={form.sort_priority}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sort_priority: Number(event.target.value) || 0,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Badge Populer</label>
                  <input
                    className="form-input"
                    value={form.badge_popular_text}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, badge_popular_text: event.target.value }))
                    }
                    placeholder="🔥 Terlaris"
                  />
                </div>
                <div>
                  <label className="form-label">Badge Garansi</label>
                  <input
                    className="form-input"
                    value={form.badge_guarantee_text}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, badge_guarantee_text: event.target.value }))
                    }
                    placeholder="🛡 Garansi 30 Hari"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Teks Highlight / Sold</label>
                <input
                  className="form-input"
                  value={form.sold_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, sold_text: event.target.value }))}
                  placeholder="🛒 5.800+ terjual bulan ini"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Catatan Shared</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={form.shared_note}
                    onChange={(event) => setForm((prev) => ({ ...prev, shared_note: event.target.value }))}
                    placeholder="Berbagi dengan pengguna lain"
                  />
                </div>
                <div>
                  <label className="form-label">Catatan Private</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={form.private_note}
                    onChange={(event) => setForm((prev) => ({ ...prev, private_note: event.target.value }))}
                    placeholder="Akun pribadi, akses penuh"
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Spesifikasi Produk (Label / Nilai)
                  </label>
                  <button className="action-btn" type="button" onClick={addSpecItem}>
                    + Tambah Spek
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {form.spec_items.map((item, index) => (
                    <div key={`spec-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                      <input
                        className="form-input"
                        value={item.label}
                        onChange={(event) =>
                          updateSpecItem(index, {
                            label: event.target.value,
                          })
                        }
                        placeholder="Label (contoh: Kualitas)"
                      />
                      <input
                        className="form-input"
                        value={item.value}
                        onChange={(event) =>
                          updateSpecItem(index, {
                            value: event.target.value,
                          })
                        }
                        placeholder="Nilai (contoh: 4K UHD)"
                      />
                      <button
                        className="action-btn"
                        type="button"
                        style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                        onClick={() => removeSpecItem(index)}
                        disabled={form.spec_items.length <= 1}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Trust Chips / Benefit
                  </label>
                  <button className="action-btn" type="button" onClick={addTrustBadge}>
                    + Tambah Trust
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {form.trust_badges.map((item, index) => (
                    <div key={`trust-${index}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 8 }}>
                      <input
                        className="form-input"
                        value={item.icon}
                        onChange={(event) =>
                          updateTrustBadge(index, {
                            icon: event.target.value,
                          })
                        }
                        placeholder="✨"
                      />
                      <input
                        className="form-input"
                        value={item.text}
                        onChange={(event) =>
                          updateTrustBadge(index, {
                            text: event.target.value,
                          })
                        }
                        placeholder="Contoh: Garansi 30 Hari"
                      />
                      <button
                        className="action-btn"
                        type="button"
                        style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                        onClick={() => removeTrustBadge(index)}
                        disabled={form.trust_badges.length <= 1}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    FAQ Produk
                  </label>
                  <button className="action-btn" type="button" onClick={addFaqItem}>
                    + Tambah FAQ
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {form.faq_items.map((item, index) => (
                    <div key={`faq-${index}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                      <input
                        className="form-input"
                        value={item.question}
                        onChange={(event) =>
                          updateFaqItem(index, {
                            question: event.target.value,
                          })
                        }
                        placeholder={`Pertanyaan ${index + 1}`}
                      />
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={item.answer}
                        onChange={(event) =>
                          updateFaqItem(index, {
                            answer: event.target.value,
                          })
                        }
                        placeholder="Jawaban FAQ"
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="action-btn"
                          type="button"
                          style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                          onClick={() => removeFaqItem(index)}
                          disabled={form.faq_items.length <= 1}
                        >
                          Hapus FAQ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Harga Coret / Normal</label>
                  <input
                    className="form-input"
                    value={form.price_original_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        price_original_text: event.target.value,
                      }))
                    }
                    placeholder="Contoh: Rp 54.000"
                  />
                </div>
                <div>
                  <label className="form-label">Teks Harga Harian</label>
                  <input
                    className="form-input"
                    value={form.price_per_day_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        price_per_day_text: event.target.value,
                      }))
                    }
                    placeholder="Contoh: ≈ Rp 1.300/hari"
                  />
                </div>
                <div>
                  <label className="form-label">Teks Badge Diskon</label>
                  <input
                    className="form-input"
                    value={form.discount_badge_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        discount_badge_text: event.target.value,
                      }))
                    }
                    placeholder="Contoh: Promo aktif · hemat 25%"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.show_whatsapp_button}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        show_whatsapp_button: event.target.checked,
                      }))
                    }
                  />
                  Tampilkan Tombol WhatsApp
                </label>

                <div>
                  <label className="form-label">Nomor WhatsApp CS</label>
                  <input
                    className="form-input"
                    value={form.whatsapp_number}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        whatsapp_number: sanitizeWhatsAppNumber(event.target.value),
                      }))
                    }
                    placeholder="62812xxxx"
                  />
                </div>

                <div>
                  <label className="form-label">Label Tombol WhatsApp</label>
                  <input
                    className="form-input"
                    value={form.whatsapp_button_text}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        whatsapp_button_text: event.target.value,
                      }))
                    }
                    placeholder="Tanya via WhatsApp"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Meta Description (SEO)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={form.seo_description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      seo_description: event.target.value,
                    }))
                  }
                  placeholder="Deskripsi SEO untuk halaman produk"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.is_popular}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_popular: event.target.checked }))}
                  />
                  Populer
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  Aktif
                </label>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--border)' }} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: 0 }}>
                      Paket Harga Prem-Apps
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Kombinasi unik berdasarkan account_type + durasi bulan.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="action-btn" type="button" onClick={() => addPriceRow('shared')}>
                      + Shared
                    </button>
                    <button className="action-btn" type="button" onClick={() => addPriceRow('private')}>
                      + Private
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {priceDrafts.length === 0 ? (
                    <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--muted)' }}>
                      Belum ada paket harga. Tambahkan minimal satu paket agar produk bisa dibeli.
                    </div>
                  ) : (
                    priceDrafts.map((row) => (
                      <div key={row.local_id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <label className="form-label">Tipe</label>
                            <select
                              className="form-select"
                              value={row.account_type}
                              onChange={(event) =>
                                updatePriceRow(row.local_id, {
                                  account_type: event.target.value as ProductPrice['account_type'],
                                })
                              }
                            >
                              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label">Durasi (bulan)</label>
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              value={row.duration}
                              onChange={(event) => {
                                const nextDuration = Number(event.target.value) || 0
                                const currentDefaultLabel = normalizePriceLabel('', row.duration)
                                const shouldSyncLabel =
                                  !row.label.trim() || row.label.trim() === currentDefaultLabel

                                updatePriceRow(row.local_id, {
                                  duration: nextDuration,
                                  label: shouldSyncLabel
                                    ? normalizePriceLabel('', nextDuration)
                                    : row.label,
                                })
                              }}
                            />
                          </div>

                          <div>
                            <label className="form-label">Harga (IDR)</label>
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              value={row.price}
                              onChange={(event) =>
                                updatePriceRow(row.local_id, {
                                  price: Number(event.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label className="form-label">Label Paket</label>
                            <input
                              className="form-input"
                              value={row.label}
                              onChange={(event) =>
                                updatePriceRow(row.local_id, {
                                  label: event.target.value,
                                })
                              }
                              placeholder={`${row.duration} Bulan`}
                            />
                          </div>

                          <div>
                            <label className="form-label">Teks Hemat (opsional)</label>
                            <input
                              className="form-input"
                              value={row.savings_text}
                              onChange={(event) =>
                                updatePriceRow(row.local_id, {
                                  savings_text: event.target.value,
                                })
                              }
                              placeholder="Contoh: Hemat 20%"
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={row.is_active}
                              onChange={(event) =>
                                updatePriceRow(row.local_id, {
                                  is_active: event.target.checked,
                                })
                              }
                            />
                            Aktif di katalog
                          </label>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatRupiah(row.price)}</span>
                            <button
                              className="action-btn"
                              type="button"
                              style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                              onClick={() => removePriceRow(row.local_id)}
                            >
                              Hapus Paket
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {removedPriceIds.length > 0 && (
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 6 }}>
                    {removedPriceIds.length} paket existing akan dinonaktifkan saat simpan.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="topbar-btn" onClick={closeForm} disabled={saving}>
                  Batal
                </button>
                <button className="topbar-btn primary" onClick={submitForm} disabled={saving}>
                  {saving
                    ? 'Menyimpan...'
                    : formMode === 'create'
                      ? 'Simpan Produk + Konten + Harga'
                      : 'Update Produk + Konten + Harga'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
