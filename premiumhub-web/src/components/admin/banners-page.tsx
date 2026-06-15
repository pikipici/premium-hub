"use client"

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { bannerService } from '@/services/bannerService'
import type { SiteBanner } from '@/types/banner'

export default function AdminBannersPage() {
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#141414]">Banner Situs</h1>
          <p className="text-xs text-[#888] mt-0.5">Kelola banner yang tampil di halaman katalog DigiProduct.</p>
        </div>
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
    </div>
  )
}
