"use client"

import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { productService } from '@/services/productService'
import type { Product, ProductPrice } from '@/types/product'

type FormState = {
  name: string
  slug: string
  category: string
  description: string
  icon: string
  color: string
  is_popular: boolean
  is_active: boolean
}

type ProductPriceDraft = {
  local_id: string
  id?: string
  duration: number
  account_type: ProductPrice['account_type']
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

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  category: 'streaming',
  description: '',
  icon: '📦',
  color: '#FDDAC8',
  is_popular: false,
  is_active: true,
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getLowestPrice(product: Product): number | null {
  if (!product.prices || product.prices.length === 0) return null

  const activePrices = product.prices.filter((p) => p.is_active)
  const source = activePrices.length > 0 ? activePrices : product.prices
  const sorted = source.map((p) => p.price).sort((a, b) => a - b)
  return sorted[0] ?? null
}

function getCategoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }
  return fallback
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

function createLocalID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `price-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createPriceDraft(partial?: Partial<ProductPriceDraft>): ProductPriceDraft {
  return {
    local_id: createLocalID(),
    duration: 1,
    account_type: 'shared',
    price: 10000,
    is_active: true,
    ...partial,
  }
}

function normalizeDrafts(prices: ProductPrice[]): ProductPriceDraft[] {
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
        price: price.price,
        is_active: price.is_active,
      })
    )
}

function summarizePrices(prices: ProductPrice[]) {
  if (!prices || prices.length === 0) return 'Belum ada paket'

  const active = prices.filter((p) => p.is_active)
  const source = active.length > 0 ? active : prices

  const byType = source.reduce<Record<string, number>>((acc, price) => {
    acc[price.account_type] = (acc[price.account_type] || 0) + 1
    return acc
  }, {})

  const pieces = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, total]) => `${type} ${total}`)

  return pieces.join(' · ')
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)

  const [priceDrafts, setPriceDrafts] = useState<ProductPriceDraft[]>([])
  const [removedPriceIds, setRemovedPriceIds] = useState<string[]>([])

  const loadProducts = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await productService.adminList({ page: 1, limit: 100 })
      if (res.success) {
        setProducts(res.data)
      } else {
        setError(res.message || 'Gagal memuat produk')
      }
    } catch (err) {
      console.error('admin products fetch error', err)
      setError('Gagal memuat produk admin. Coba refresh lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false

      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'inactive' && p.is_active) return false

      if (!keyword) return true

      const haystack = [p.name, p.slug, p.description, p.category].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [products, search, categoryFilter, statusFilter])

  const openCreate = () => {
    setFormMode('create')
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSlugTouched(false)
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
    setForm({
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description ?? '',
      icon: product.icon || '📦',
      color: product.color || '#FDDAC8',
      is_popular: product.is_popular,
      is_active: product.is_active,
    })
    setSlugTouched(true)
    setPriceDrafts(
      product.prices?.length > 0
        ? normalizeDrafts(product.prices)
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

  const addPriceRow = (accountType: ProductPrice['account_type']) => {
    setPriceDrafts((prev) => [...prev, createPriceDraft({ account_type: accountType })])
  }

  const updatePriceRow = (localID: string, patch: Partial<ProductPriceDraft>) => {
    setPriceDrafts((prev) =>
      prev.map((row) => (row.local_id === localID ? { ...row, ...patch } : row))
    )
  }

  const removePriceRow = (localID: string) => {
    setPriceDrafts((prev) => {
      const target = prev.find((row) => row.local_id === localID)
      if (target?.id) {
        setRemovedPriceIds((current) =>
          current.includes(target.id as string) ? current : [...current, target.id as string]
        )
      }
      return prev.filter((row) => row.local_id !== localID)
    })
  }

  const validatePriceDrafts = () => {
    if (priceDrafts.length === 0) {
      return 'Minimal harus ada 1 paket harga aktif untuk produk prem-apps.'
    }

    const seen = new Set<string>()
    for (const row of priceDrafts) {
      if (row.duration < 1) {
        return 'Durasi paket harga minimal 1 bulan.'
      }
      if (row.price < 1) {
        return 'Nominal harga paket tidak boleh nol.'
      }

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

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      category: form.category,
      description: form.description.trim(),
      icon: form.icon.trim() || '📦',
      color: form.color.trim() || '#FDDAC8',
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

      const productID = productRes.data.id

      for (const priceID of removedPriceIds) {
        const deleteRes = await productService.adminDeletePrice(productID, priceID)
        if (!deleteRes.success) {
          setError(deleteRes.message || 'Gagal menonaktifkan harga produk')
          return
        }
      }

      for (const row of priceDrafts) {
        const pricePayload = {
          duration: row.duration,
          account_type: row.account_type,
          price: row.price,
          is_active: row.is_active,
        }

        if (row.id) {
          const updateRes = await productService.adminUpdatePrice(productID, row.id, pricePayload)
          if (!updateRes.success) {
            setError(updateRes.message || 'Gagal update harga produk')
            return
          }
          continue
        }

        const createRes = await productService.adminCreatePrice(productID, pricePayload)
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
      console.error('admin product save error', err)
      setError(mapErrorMessage(err, 'Gagal menyimpan produk + paket harga. Coba lagi sebentar.'))
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
      console.error('toggle active error', err)
      setError('Gagal mengubah status produk')
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
      console.error('archive product error', err)
      setError('Gagal mengarsipkan produk')
    }
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari nama/slug produk..."
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 260,
              }}
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
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
              <option value="all">Semua Kategori</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
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
                  <th>Popular</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat data produk...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Tidak ada produk yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const minPrice = getLowestPrice(p)
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{p.icon || '📦'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>/{p.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="product-pill">{getCategoryLabel(p.category)}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{minPrice ? formatRupiah(minPrice) : '-'}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{summarizePrices(p.prices)}</td>
                        <td>
                          <span className={`status-badge ${p.is_popular ? 's-lunas' : 's-pending'}`}>
                            {p.is_popular ? 'Populer' : 'Normal'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${p.is_active ? 's-lunas' : 's-gagal'}`}>
                            {p.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => openEdit(p)}>
                              ✏ Edit
                            </button>
                            <button
                              className={`action-btn${p.is_active ? '' : ' orange'}`}
                              onClick={() => toggleActive(p)}
                            >
                              {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              className="action-btn"
                              style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                              onClick={() => archiveProduct(p)}
                            >
                              Arsipkan
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / slug produk"
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Semua Kategori</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
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
            filteredProducts.map((p) => {
              const minPrice = getLowestPrice(p)
              return (
                <article className="mobile-card" key={p.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">
                        {p.icon || '📦'} {p.name}
                      </div>
                      <div className="mobile-card-sub">/{p.slug}</div>
                    </div>
                    <span className={`status-badge ${p.is_active ? 's-lunas' : 's-gagal'}`}>
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Kategori</span>
                    <span className="mobile-card-value">{getCategoryLabel(p.category)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Harga mulai</span>
                    <span className="mobile-card-value">{minPrice ? formatRupiah(minPrice) : '-'}</span>
                  </div>
                  <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                    <span className="mobile-card-label">Paket</span>
                    <span className="mobile-card-value" style={{ maxWidth: '68%' }}>
                      {summarizePrices(p.prices)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Flag</span>
                    <span className="mobile-card-value">{p.is_popular ? 'Populer' : 'Normal'}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button className={`action-btn${p.is_active ? '' : ' orange'}`} onClick={() => toggleActive(p)}>
                      {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      className="action-btn"
                      style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                      onClick={() => archiveProduct(p)}
                    >
                      Arsip
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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,20,.35)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="card-header">
              <h2>{formMode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk + Harga'}</h2>
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
                  onChange={(e) => {
                    const nextName = e.target.value
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
                    onChange={(e) => {
                      setSlugTouched(true)
                      setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))
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
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
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
                    onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="🎬"
                  />
                </div>
                <div>
                  <label className="form-label">Warna Kartu</label>
                  <input
                    className="form-input"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
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
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi singkat produk"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.is_popular}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_popular: e.target.checked }))}
                  />
                  Populer
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Aktif
                </label>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--border)' }} />

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
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
                    <div
                      style={{
                        border: '1px dashed var(--border)',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 12,
                        color: 'var(--muted)',
                      }}
                    >
                      Belum ada paket harga. Tambahkan minimal satu paket agar produk bisa dibeli.
                    </div>
                  ) : (
                    priceDrafts.map((row) => (
                      <div
                        key={row.local_id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: 10,
                          display: 'grid',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <label className="form-label">Tipe</label>
                            <select
                              className="form-select"
                              value={row.account_type}
                              onChange={(e) =>
                                updatePriceRow(row.local_id, {
                                  account_type: e.target.value as ProductPrice['account_type'],
                                })
                              }
                            >
                              {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
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
                              onChange={(e) =>
                                updatePriceRow(row.local_id, {
                                  duration: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="form-label">Harga (IDR)</label>
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              value={row.price}
                              onChange={(e) =>
                                updatePriceRow(row.local_id, {
                                  price: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={row.is_active}
                              onChange={(e) =>
                                updatePriceRow(row.local_id, {
                                  is_active: e.target.checked,
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
                      ? 'Simpan Produk + Harga'
                      : 'Update Produk + Harga'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
