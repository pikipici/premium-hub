"use client"

import { useEffect, useState } from 'react'
import { Loader2, Palette, Plus, Trash2, Zap } from 'lucide-react'
import { bannerService } from '@/services/bannerService'
import { heroBgService } from '@/services/heroBgService'
import { flashSaleService } from '@/services/flashSaleService'
import { productService } from '@/services/productService'
import type { SiteBanner } from '@/types/banner'
import type { SiteFlashSale } from '@/types/flashSale'
import type { Product } from '@/types/product'

const PAGE_KEY = 'digiproduct'

export default function AdminBannersPage() {
  const [activeTab, setActiveTab] = useState<'banners' | 'hero' | 'flash'>('banners')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">Tampilan Situs</h1>
          <p className="text-xs text-[#888] mt-0.5">Kelola banner dan background hero katalog DigiProduct.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-[#F4F5F8] rounded-xl p-1">
        <button
          onClick={() => setActiveTab('banners')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'banners'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          }`}
        >
          Banner
        </button>
        <button
          onClick={() => setActiveTab('hero')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'hero'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          }`}
        >
          <Palette className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          Hero Background
        </button>
        <button
          onClick={() => setActiveTab('flash')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'flash'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          }`}
        >
          <Zap className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          Flash Sale
        </button>
      </div>

      {activeTab === 'banners' ? <BannersTab /> : activeTab === 'hero' ? <HeroBgTab /> : <FlashSaleTab />}
    </div>
  )
}

function BannersTab() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SiteBanner | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [imageURL, setImageURL] = useState('')
  const [linkURL, setLinkURL] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const fetchBanners = () => {
    setLoading(true)
    bannerService.adminList()
      .then((res) => { if (res.success) setBanners(res.data ?? []) })
      .catch(() => setError('Gagal memuat banner'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBanners() }, [])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setImageURL('')
    setLinkURL('')
    setSortOrder(0)
    setIsActive(true)
    setFormOpen(true)
  }

  const openEdit = (b: SiteBanner) => {
    setEditing(b)
    setTitle(b.title)
    setImageURL(b.image_url)
    setLinkURL(b.link_url)
    setSortOrder(b.sort_order)
    setIsActive(b.is_active)
    setFormOpen(true)
  }

  const resetForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    if (!title.trim() || !imageURL.trim()) {
      setError('Judul dan URL gambar wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { title: title.trim(), image_url: imageURL.trim(), link_url: linkURL.trim(), sort_order: sortOrder, is_active: isActive }
      const res = editing
        ? await bannerService.adminUpdate(editing.id, payload)
        : await bannerService.adminCreate(payload)
      if (res.success) {
        resetForm()
        fetchBanners()
      } else {
        setError(res.message || 'Gagal menyimpan')
      }
    } catch {
      setError('Gagal menyimpan banner')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus banner ini?')) return
    try {
      const res = await bannerService.adminDelete(id)
      if (res.success) fetchBanners()
      else setError(res.message || 'Gagal menghapus')
    } catch {
      setError('Gagal menghapus banner')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#888]">Banner yang tampil di slider hero katalog DigiProduct.</p>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-full bg-[#141414] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2A2A]">
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-600 text-sm px-4 py-2.5 mb-4 font-medium">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
      ) : banners.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#D5D5D0] bg-white">
          <p className="text-sm text-[#888]">Belum ada banner. Klik Tambah untuk membuat banner baru.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-4">
              <img src={b.image_url} alt={b.title} className="h-14 w-24 object-cover rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[#141414] truncate">{b.title}</div>
                <div className="text-[11px] text-[#888] truncate">{b.link_url || 'Tanpa link'}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px]">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {b.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="text-[#AAA]">Urutan {b.sort_order}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(b)} className="rounded-lg border border-[#E5E5E5] px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F7F7F5]">
                  Edit
                </button>
                <button onClick={() => handleDelete(b.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={resetForm}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">{editing ? 'Edit Banner' : 'Banner Baru'}</h2>

            <label className="block text-xs font-bold text-[#555]">
              Judul
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Promo Spesial Juni" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
            </label>
            <label className="block text-xs font-bold text-[#555]">
              URL Gambar
              <input value={imageURL} onChange={(e) => setImageURL(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
            </label>
            <label className="block text-xs font-bold text-[#555]">
              Link Tujuan
              <input value={linkURL} onChange={(e) => setLinkURL(e.target.value)} placeholder="/product/digiproduct atau https://" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#555]">
                Urutan
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
              </label>
              <label className="flex items-center gap-2 mt-5 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#FF5733]" />
                <span className="text-xs font-bold text-[#555]">Aktif</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={resetForm} className="flex-1 rounded-full border border-[#E5E5E5] py-3 text-sm font-semibold">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-[#141414] py-3 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function HeroBgTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [bgColor, setBgColor] = useState('#141414')
  const [bgImage, setBgImage] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    heroBgService.adminGetHeroBg(PAGE_KEY)
      .then((res) => {
        if (res.success && res.data) {
          setBgColor(res.data.background_color || '#141414')
          setBgImage(res.data.background_image_url || '')
          setIsActive(res.data.is_active)
        }
      })
      .catch(() => setError('Gagal memuat data'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await heroBgService.adminSaveHeroBg({
        page_key: PAGE_KEY,
        background_color: bgColor,
        background_image_url: bgImage.trim(),
        is_active: isActive,
      })
      if (res.success) {
        setMessage('Hero background berhasil disimpan')
      } else {
        setError(res.message || 'Gagal menyimpan')
      }
    } catch {
      setError('Gagal menyimpan hero background')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-[#888]">Atur warna background dan gambar untuk section hero katalog DigiProduct.</p>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-600 text-sm px-4 py-2.5 font-medium">{error}</div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5 font-medium">{message}</div>
      )}

      <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5 space-y-4">
        <label className="block">
          <span className="text-xs font-bold text-[#555]">Warna Background</span>
          <div className="flex items-center gap-3 mt-1.5">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '#141414'}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-10 w-14 rounded-lg border border-[#E5E5E5] cursor-pointer bg-transparent"
            />
            <input
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#141414"
              className="flex-1 rounded-xl border border-[#E5E5E5] px-4 py-2.5 text-sm font-mono outline-none focus:border-[#FF5733]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-[#555]">URL Gambar Background (opsional)</span>
          <input
            value={bgImage}
            onChange={(e) => setBgImage(e.target.value)}
            placeholder="https://..."
            className="mt-1.5 w-full rounded-xl border border-[#E5E5E5] px-4 py-2.5 text-sm outline-none focus:border-[#FF5733]"
          />
          <p className="text-[10px] text-[#AAA] mt-1">Kosongkan kalau cuma mau pakai warna solid.</p>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#FF5733]" />
          <span className="text-xs font-bold text-[#555]">Aktif</span>
        </label>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-[#EBEBEB]">
          <div className="text-[10px] font-bold text-[#AAA] px-3 py-1.5 bg-[#F9F9F9] border-b border-[#EBEBEB]">Preview Hero</div>
          <div
            className="h-24 flex items-center justify-center"
            style={{
              backgroundColor: bgColor,
              ...(bgImage.trim() ? {
                backgroundImage: `url(${bgImage.trim()})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : {}),
            }}
          >
            <span className="text-sm font-bold text-white/70 drop-shadow-md">Gas Cek katalog DigiProduct</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-full bg-[#141414] py-3 text-sm font-bold text-white hover:bg-[#2A2A2A] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Menyimpan...' : 'Simpan Background'}
        </button>
      </div>
    </div>
  )
}

function FlashSaleTab() {
  const [items, setItems] = useState<SiteFlashSale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SiteFlashSale | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      flashSaleService.adminList(),
      productService.list({ limit: 100 }),
    ]).then(([fsRes, prodRes]) => {
      if (fsRes.success) setItems(fsRes.data ?? [])
      if (prodRes.success) setProducts(prodRes.data ?? [])
    }).catch(() => setError('Gagal memuat data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 16)
  }

  const openCreate = () => {
    setEditing(null)
    setSelectedProductId('')
    setDeadline('')
    setSortOrder(items.length)
    setIsActive(true)
    setFormOpen(true)
  }

  const openEdit = (item: SiteFlashSale) => {
    setEditing(item)
    setSelectedProductId(item.product_id)
    setDeadline(toLocalDatetime(item.ends_at))
    setSortOrder(item.sort_order)
    setIsActive(item.is_active)
    setFormOpen(true)
  }

  const resetForm = () => {
    setFormOpen(false)
    setEditing(null)
    setError('')
  }

  const handleSave = async () => {
    if (!selectedProductId) {
      setError('Pilih produk')
      return
    }
    if (!deadline) {
      setError('Atur deadline')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        product_id: selectedProductId,
        ends_at: new Date(deadline).toISOString(),
        sort_order: sortOrder,
        is_active: isActive,
      }
      const res = editing
        ? await flashSaleService.adminUpdate(editing.id, payload as Partial<SiteFlashSale>)
        : await flashSaleService.adminCreate(payload as Partial<SiteFlashSale>)
      if (res.success) {
        setMessage(editing ? 'Flash sale diperbarui' : 'Flash sale dibuat')
        resetForm()
        fetchData()
      } else {
        setError(res.message || 'Gagal menyimpan')
      }
    } catch {
      setError('Gagal menyimpan flash sale')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus dari flash sale?')) return
    try {
      const res = await flashSaleService.adminDelete(id)
      if (res.success) {
        setMessage('Dihapus dari flash sale')
        fetchData()
      } else {
        setError(res.message || 'Gagal menghapus')
      }
    } catch {
      setError('Gagal menghapus flash sale')
    }
  }

  const getProductName = (productId: string) => {
    return products.find((p) => p.id === productId)?.name || productId
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#888]">Produk yang tampil di section Flash Sale katalog DigiProduct.</p>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-full bg-[#141414] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2A2A]">
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-600 text-sm px-4 py-2.5 font-medium">{error}</div>
      )}
      {message && (
        <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5 font-medium">{message}</div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#D5D5D0] bg-white">
          <p className="text-sm text-[#888]">Belum ada produk flash sale. Klik Tambah.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const product = item.product
            const img = product?.cover_images?.[0] || product?.icon_image_url
            return (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-4">
                <div className="h-14 w-24 rounded-lg shrink-0 bg-[#F7F7F5] flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img src={img} alt={product?.name || ''} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">{product?.icon || '📦'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#141414] truncate">
                    {product?.name || getProductName(item.product_id)}
                  </div>
                  <div className="text-[11px] text-[#888]">
                    Deadline: {new Date(item.ends_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {item.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-[#AAA]">Urutan {item.sort_order}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="rounded-lg border border-[#E5E5E5] px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F7F7F5]">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={resetForm}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold">{editing ? 'Edit Flash Sale' : 'Tambah Flash Sale'}</h2>

            <label className="block text-xs font-bold text-[#555]">
              Produk
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733] bg-white"
              >
                <option value="">-- Pilih Produk --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-bold text-[#555]">
              Deadline
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#555]">
                Urutan
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
              </label>
              <label className="flex items-center gap-2 mt-5 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-[#FF5733]" />
                <span className="text-xs font-bold text-[#555]">Aktif</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={resetForm} className="flex-1 rounded-full border border-[#E5E5E5] py-3 text-sm font-semibold">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-[#141414] py-3 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
