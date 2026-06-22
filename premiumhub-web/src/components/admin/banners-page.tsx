"use client"

import { useEffect, useRef, useState } from 'react'
import { Loader2, Palette, Plus, Sparkles, Trash2, Zap } from 'lucide-react'
import { bannerService } from '@/services/bannerService'
import { heroBgService } from '@/services/heroBgService'
import { flashSaleService } from '@/services/flashSaleService'
import { productService } from '@/services/productService'
import { sosmedHeroSlideService } from '@/services/sosmedHeroSlideService'
import type { SiteBanner } from '@/types/banner'
import type { SiteFlashSale } from '@/types/flashSale'
import type { Product } from '@/types/product'
import type { SosmedHeroSlide } from '@/types/sosmedHeroSlide'


const PAGE_KEY = 'digiproduct'

export default function AdminBannersPage() {
  const [activeTab, setActiveTab] = useState<'banners' | 'hero' | 'flash' | 'sosmed-hero'>('banners')

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
        <button
          onClick={() => setActiveTab('sosmed-hero')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
            activeTab === 'sosmed-hero'
              ? 'bg-white text-[#141414] shadow-sm'
              : 'text-[#888] hover:text-[#555]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          Sosmed Hero
        </button>
      </div>

      {activeTab === 'banners' ? <BannersTab /> : activeTab === 'hero' ? <HeroBgTab /> : activeTab === 'flash' ? <FlashSaleTab /> : <SosmedHeroTab />}
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
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageURL, setImageURL] = useState('')
  const [linkURL, setLinkURL] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBanners = () => {
    setLoading(true)
    bannerService.adminList()
      .then((res) => { if (res.success) setBanners(res.data ?? []) })
      .catch(() => setError('Gagal memuat banner'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBanners() }, [])

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const res = await bannerService.adminUploadImage(file)
      if (res.success && res.data?.url) {
        setImageURL(res.data.url)
      } else {
        setError(res.message || 'Gagal upload gambar')
      }
    } catch {
      setError('Gagal upload gambar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setDescription('')
    setImageURL('')
    setLinkURL('')
    setSortOrder(0)
    setIsActive(true)
    setError('')
    setFormOpen(true)
  }

  const openEdit = (b: SiteBanner) => {
    setEditing(b)
    setTitle(b.title)
    setDescription(b.description || '')
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
      setError('Judul dan gambar wajib diisi')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { title: title.trim(), description: description.trim(), image_url: imageURL.trim(), link_url: linkURL.trim(), sort_order: sortOrder, is_active: isActive }
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
              Deskripsi
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat banner..." rows={2} className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733] resize-none" />
            </label>
            <label className="block text-xs font-bold text-[#555]">
              Gambar
              <div className="mt-1">
                {imageURL ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#E5E5E5]">
                    <img src={imageURL} alt="Preview" className="h-32 w-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="opacity-0 hover:opacity-100 transition-opacity rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#141414]"
                      >
                        Ganti Gambar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageURL('')}
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D5D5D0] bg-[#F9F9F9] px-4 py-6 hover:border-[#FF5733] hover:bg-[#FFF8F5] transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-[#888]" />
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#AAA]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="mt-2 text-xs font-medium text-[#888]">Klik untuk upload gambar</span>
                        <span className="mt-0.5 text-[10px] text-[#AAA]">PNG, JPG, WebP — min 640x360, maks 5MB</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadImage}
                  className="hidden"
                />
              </div>
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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const res = await heroBgService.adminUploadImage(file)
      if (res.success && res.data?.url) {
        setBgImage(res.data.url)
      } else {
        setError(res.message || 'Gagal upload gambar')
      }
    } catch {
      setError('Gagal upload gambar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
          <span className="text-xs font-bold text-[#555]">Gambar Background (opsional)</span>
          <div className="mt-1.5">
            {bgImage ? (
              <div className="relative rounded-xl overflow-hidden border border-[#E5E5E5]">
                <img src={bgImage} alt="Preview" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute top-1.5 left-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[#141414] hover:bg-white"
                >
                  Ganti
                </button>
                <button
                  type="button"
                  onClick={() => setBgImage('')}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D5D5D0] bg-[#F9F9F9] px-4 py-6 hover:border-[#FF5733] hover:bg-[#FFF8F5] transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#888]" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#AAA]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="mt-2 text-xs font-medium text-[#888]">Klik untuk upload gambar</span>
                    <span className="mt-0.5 text-[10px] text-[#AAA]">PNG, JPG, WebP — kosongkan kalau cuma warna solid</span>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUploadImage}
              className="hidden"
            />
          </div>
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

const SOSMED_HERO_ICONS = [
  { value: 'Sparkles', label: 'Sparkles' },
  { value: 'Flame', label: 'Flame' },
  { value: 'Megaphone', label: 'Megaphone' },
  { value: 'Zap', label: 'Zap' },
  { value: 'Star', label: 'Star' },
  { value: 'Rocket', label: 'Rocket' },
  { value: 'Crown', label: 'Crown' },
  { value: 'TrendingUp', label: 'TrendingUp' },
]

function SosmedHeroTab() {
  const [slides, setSlides] = useState<SosmedHeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SosmedHeroSlide | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaHref, setCtaHref] = useState('')
  const [icon, setIcon] = useState('Sparkles')
  const [bgColor, setBgColor] = useState('#141414')
  const [bgImageURL, setBgImageURL] = useState('')
  const [featuredServiceCodes, setFeaturedServiceCodes] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [formActive, setFormActive] = useState(true)

  const fetchSlides = async () => {
    setLoading(true)
    try {
      const res = await sosmedHeroSlideService.adminList()
      if (res.success && res.data) setSlides(res.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchSlides() }, [])

  const resetForm = () => {
    setEditing(null); setFormOpen(false)
    setTitle(''); setSubtitle(''); setCtaLabel(''); setCtaHref('')
    setIcon('Sparkles'); setBgColor('#141414'); setBgImageURL(''); setFeaturedServiceCodes('')
    setSortOrder(0); setFormActive(true)
    setError(''); setSuccess('')
  }

  const openCreate = () => { resetForm(); setFormOpen(true) }

  const openEdit = (s: SosmedHeroSlide) => {
    setEditing(s)
    setTitle(s.title); setSubtitle(s.subtitle || ''); setCtaLabel(s.cta_label || ''); setCtaHref(s.cta_href || '')
    setIcon(s.icon || 'Sparkles'); setBgColor(s.background_color || '#141414'); setBgImageURL(s.background_image_url || '')
    setFeaturedServiceCodes((s.featured_service_codes || []).join(', '))
    setSortOrder(s.sort_order || 0); setFormActive(s.is_active ?? true)
    setFormOpen(true)
  }

  const handleUpload = async (file: File) => {
    setUploading(true); setError('')
    try {
      const res = await sosmedHeroSlideService.adminUploadImage(file)
      if (res.success && res.data?.url) setBgImageURL(res.data.url)
      else setError(res.message || 'Gagal upload gambar')
    } catch { setError('Gagal upload gambar') } finally { setUploading(false) }
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Judul wajib diisi'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const payload = { title: title.trim(), subtitle: subtitle.trim(), cta_label: ctaLabel.trim(), cta_href: ctaHref.trim(), icon, background_color: bgColor, background_image_url: bgImageURL, featured_service_codes: featuredServiceCodes.split(',').map(s => s.trim()).filter(Boolean), sort_order: sortOrder, is_active: formActive }
      const res = editing ? await sosmedHeroSlideService.adminUpdate(editing.id, payload) : await sosmedHeroSlideService.adminCreate(payload)
      if (res.success) { resetForm(); fetchSlides(); setSuccess('Slide berhasil disimpan') }
      else setError(res.message || 'Gagal menyimpan')
    } catch { setError('Gagal menyimpan') } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus slide ini?')) return
    try {
      const res = await sosmedHeroSlideService.adminDelete(id)
      if (res.success) { fetchSlides(); setSuccess('Slide berhasil dihapus') }
      else setError(res.message || 'Gagal menghapus')
    } catch { setError('Gagal menghapus') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#888]">Kelola slide hero untuk halaman DigiSosmed.</p>
        <button onClick={openCreate} className="rounded-full bg-[#FF5733] px-4 py-2 text-xs font-bold text-white hover:bg-[#e64d2e] transition">
          <Plus className="h-3.5 w-3.5 inline mr-1 -mt-0.5" /> Tambah Slide
        </button>
      </div>

      {success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-600">{success}</div>}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#888]" /></div>
      ) : slides.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] px-6 py-12 text-center">
          <p className="text-sm font-semibold text-[#888]">Belum ada hero slide.</p>
          <p className="text-xs text-[#999] mt-1">Klik &quot;Tambah Slide&quot; untuk membuat slide pertama.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-[#EBEBEB] bg-white p-4">
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: s.background_color || '#141414' }}>
                {s.background_image_url ? (
                  <img src={s.background_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-bold text-white/60">{s.sort_order}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                    {s.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <span className="text-[10px] text-[#888]">Urutan: {s.sort_order}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(s)} className="rounded-full border border-[#E5E5E5] px-3 py-1.5 text-[11px] font-semibold hover:bg-[#F7F7F5] transition">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition"><Trash2 className="h-3 w-3 inline mr-0.5 -mt-0.5" />Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={resetForm}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4">{editing ? 'Edit Slide' : 'Tambah Slide'}</h3>

            <div className="mb-4 rounded-2xl p-5 text-white" style={{ backgroundColor: bgColor }}>
              {bgImageURL && <img src={bgImageURL} alt="" className="mb-3 h-24 w-full rounded-xl object-cover" />}
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" /> DigiSosmed
              </div>
              <h4 className="mt-2 text-base font-extrabold">{title || 'Judul Slide'}</h4>
              <p className="mt-1 text-xs text-white/80">{subtitle || 'Subtitle slide...'}</p>
              {ctaLabel && <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-bold">{ctaLabel} →</span>}
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#555]">
                  Judul
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul slide" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                </label>
                <label className="block text-xs font-bold text-[#555]">
                  Icon
                  <select value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]">
                    {SOSMED_HERO_ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold text-[#555]">
                Subtitle
                <textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={2} placeholder="Subtitle slide..." className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
              </label>

              <label className="block text-xs font-bold text-[#555]">
                Produk Unggulan (kode produk, pisahkan dengan koma)
                <input value={featuredServiceCodes} onChange={(e) => setFeaturedServiceCodes(e.target.value)} placeholder="jap-6331, jap-10242, jap-8695" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                <p className="mt-1 text-[10px] text-[#999]">Kode produk yang tampil sebagai card di samping hero slide. Isi 2 kode biar pas.</p>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#555]">
                  Tombol CTA
                  <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Mulai Order" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                </label>
                <label className="block text-xs font-bold text-[#555]">
                  Link CTA
                  <input value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="#layanan" className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#555]">
                  Warna Background
                  <div className="mt-1 flex gap-2">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-11 w-11 cursor-pointer rounded-xl border border-[#E5E5E5]" />
                    <input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1 rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                  </div>
                </label>
                <label className="block text-xs font-bold text-[#555]">
                  Gambar Background
                  <div className="mt-1 flex gap-2">
                    <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-[#E5E5E5] px-4 py-3 text-center text-sm font-semibold text-[#888] hover:border-[#FF5733]">
                      {uploading ? 'Uploading...' : 'Pilih Gambar'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                    </label>
                    {bgImageURL && <button onClick={() => setBgImageURL('')} className="rounded-xl border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50">Hapus</button>}
                  </div>
                  {bgImageURL && <img src={bgImageURL} alt="" className="mt-2 h-16 w-full rounded-xl object-cover" />}
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-[#555]">
                  Urutan
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]" />
                </label>
                <label className="flex items-center gap-2 mt-5 cursor-pointer">
                  <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="accent-[#FF5733]" />
                  <span className="text-xs font-bold text-[#555]">Aktif</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
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
