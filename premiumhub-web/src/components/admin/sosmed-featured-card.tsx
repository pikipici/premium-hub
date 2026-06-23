'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { sosmedHeroSlideService } from '@/services/sosmedHeroSlideService'
import type { SosmedHeroSlide } from '@/types/sosmedHeroSlide'

export default function SosmedFeaturedCard() {
  const [slide, setSlide] = useState<SosmedHeroSlide | null>(null)
  const [codes, setCodes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    sosmedHeroSlideService.adminList().then((res) => {
      if (res.success && res.data?.length) {
        const first = res.data[0]
        setSlide(first)
        setCodes((first.featured_service_codes || []).join(', '))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setMsg('')
    const parsed = codes.split(',').map(s => s.trim()).filter(Boolean)
    try {
      let targetId = slide?.id
      if (!targetId) {
        const created = await sosmedHeroSlideService.adminCreate({
          title: 'Hero Slide',
          featured_service_codes: parsed,
        })
        if (!created.success) {
          setMsg(created.message || 'Gagal membuat hero slide')
          return
        }
        targetId = created.data?.id
        if (targetId) setSlide(created.data || null)
      } else {
        const res = await sosmedHeroSlideService.adminUpdate(targetId, { featured_service_codes: parsed })
        if (!res.success) {
          setMsg(res.message || 'Gagal menyimpan')
          return
        }
        setSlide(res.data || slide)
      }
      setMsg('Produk unggulan berhasil disimpan')
    } catch {
      setMsg('Gagal menyimpan')
    } finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#888]" /></div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#EBEBEB] bg-white p-5">
      <h3 className="text-sm font-bold mb-1">Produk Unggulan di Hero</h3>
      <p className="mb-4 text-xs text-[#888]">Pilih 4 produk yang tampil sebagai card di samping hero slide halaman DigiSosmed. Isi kode produk, pisahkan dengan koma.</p>

      {!slide ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
          Belum ada hero slide — simpan produk unggulan di bawah untuk auto-buat slide baru.
        </p>
      ) : (
        <div className="mb-3 rounded-xl bg-[#F7F7F5] p-3">
          <p className="text-xs font-semibold text-[#555]">Hero Slide: <span className="text-[#141414]">{slide.title}</span></p>
        </div>
      )}
      <input
        value={codes}
        onChange={(e) => setCodes(e.target.value)}
        placeholder="jap-6331, jap-10242"
        className="mb-2 w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]"
      />
      {msg && (
        <p className={`mb-2 text-xs font-semibold ${msg.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#141414] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#333] disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : <><Save className="h-3.5 w-3.5" /> Simpan</>}
      </button>
    </div>
  )
}
