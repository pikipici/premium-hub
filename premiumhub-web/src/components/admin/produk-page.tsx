"use client"

import { useEffect, useMemo, useState } from 'react'
import { productService } from '@/services/productService'
import type { Product } from '@/types/product'

type FormState = {
  name: string
  category: string
  description: string
  icon: string
  color: string
  is_popular: boolean
  is_active: boolean
}

const CATEGORY_OPTIONS = [
  { value: 'streaming', label: 'Streaming' },
  { value: 'music', label: 'Musik' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'design', label: 'Desain' },
  { value: 'productivity', label: 'Produktivitas' },
]

const EMPTY_FORM: FormState = {
  name: '',
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
    loadProducts()
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
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setFormMode('edit')
    setEditingId(product.id)
    setForm({
      name: product.name,
      category: product.category,
      description: product.description ?? '',
      icon: product.icon || '📦',
      color: product.color || '#FDDAC8',
      is_popular: product.is_popular,
      is_active: product.is_active,
    })
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
  }

  const submitForm = async () => {
    if (!form.name.trim()) {
      setError('Nama produk wajib diisi')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      icon: form.icon.trim() || '📦',
      color: form.color.trim() || '#FDDAC8',
      is_popular: form.is_popular,
      is_active: form.is_active,
    }

    try {
      const res =
        formMode === 'create'
          ? await productService.adminCreate(payload)
          : await productService.adminUpdate(editingId as string, payload)

      if (!res.success) {
        setError(res.message || 'Gagal simpan produk')
        return
      }

      setFormOpen(false)
      setNotice(formMode === 'create' ? 'Produk baru berhasil dibuat.' : 'Produk berhasil diperbarui.')
      await loadProducts()
    } catch (err) {
      console.error('admin product save error', err)
      setError('Gagal menyimpan produk. Coba lagi sebentar.')
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
        <div className="alert-bar" style={{ marginBottom: 12, background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
          ⚠️ <strong>{error}</strong>
        </div>
      )}

      <div className="admin-desktop-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari nama/slug produk..."
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none', width: 260 }}
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}
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
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          <button className="topbar-btn primary" onClick={openCreate}>+ Tambah Produk Baru</button>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Harga Mulai</th>
                  <th>Popular</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
                      Memuat data produk...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
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
                        <td><span className="product-pill">{getCategoryLabel(p.category)}</span></td>
                        <td style={{ fontWeight: 600 }}>{minPrice ? formatRupiah(minPrice) : '-'}</td>
                        <td><span className={`status-badge ${p.is_popular ? 's-lunas' : 's-pending'}`}>{p.is_popular ? 'Populer' : 'Normal'}</span></td>
                        <td><span className={`status-badge ${p.is_active ? 's-lunas' : 's-gagal'}`}>{p.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => openEdit(p)}>✏ Edit</button>
                            <button className={`action-btn${p.is_active ? '' : ' orange'}`} onClick={() => toggleActive(p)}>
                              {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button className="action-btn" style={{ color: 'var(--red)', borderColor: '#FECACA' }} onClick={() => archiveProduct(p)}>
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
            <div className="mobile-page-subtitle">CRUD produk aktif/nonaktif</div>
          </div>
          <button className="mobile-chip-btn primary" onClick={openCreate}>+ Baru</button>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Semua Kategori</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card"><div className="mobile-card-sub">Memuat data produk...</div></article>
          ) : filteredProducts.length === 0 ? (
            <article className="mobile-card"><div className="mobile-card-sub">Tidak ada produk untuk filter saat ini.</div></article>
          ) : (
            filteredProducts.map((p) => {
              const minPrice = getLowestPrice(p)
              return (
                <article className="mobile-card" key={p.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">{p.icon || '📦'} {p.name}</div>
                      <div className="mobile-card-sub">/{p.slug}</div>
                    </div>
                    <span className={`status-badge ${p.is_active ? 's-lunas' : 's-gagal'}`}>{p.is_active ? 'Aktif' : 'Nonaktif'}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Kategori</span>
                    <span className="mobile-card-value">{getCategoryLabel(p.category)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Harga mulai</span>
                    <span className="mobile-card-value">{minPrice ? formatRupiah(minPrice) : '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Flag</span>
                    <span className="mobile-card-value">{p.is_popular ? 'Populer' : 'Normal'}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn" onClick={() => openEdit(p)}>Edit</button>
                    <button className={`action-btn${p.is_active ? '' : ' orange'}`} onClick={() => toggleActive(p)}>
                      {p.is_active ? 'Off' : 'On'}
                    </button>
                    <button className="action-btn" style={{ color: 'var(--red)', borderColor: '#FECACA' }} onClick={() => archiveProduct(p)}>
                      Arsip
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <button className="mobile-fab" onClick={openCreate}>+ Produk</button>
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
              maxWidth: 560,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="card-header">
              <h2>{formMode === 'create' ? 'Tambah Produk Baru' : 'Edit Produk'}</h2>
              <button className="action-btn" onClick={closeForm} disabled={saving}>Tutup</button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div>
                <label className="form-label">Nama Produk</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: Netflix Premium"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Kategori</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Icon</label>
                  <input
                    className="form-input"
                    value={form.icon}
                    onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                    placeholder="🎬"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Warna Kartu</label>
                  <input
                    className="form-input"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="#FDDAC8"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={form.is_popular}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_popular: e.target.checked }))}
                    /> Populer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    /> Aktif
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="topbar-btn" onClick={closeForm} disabled={saving}>Batal</button>
                <button className="topbar-btn primary" onClick={submitForm} disabled={saving}>
                  {saving ? 'Menyimpan...' : formMode === 'create' ? 'Simpan Produk' : 'Update Produk'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
