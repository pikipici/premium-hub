'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Package, Save } from 'lucide-react'
import { sosmedHeroSlideService } from '@/services/sosmedHeroSlideService'
import { sosmedService } from '@/services/sosmedService'
import { buildSosmedServiceCards } from '@/lib/sosmedProductCards'
import type { SosmedHeroSlide } from '@/types/sosmedHeroSlide'
import type { SosmedService } from '@/types/sosmedService'

export default function SosmedFeaturedCard() {
  const [slide, setSlide] = useState<SosmedHeroSlide | null>(null)
  const [codes, setCodes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [services, setServices] = useState<SosmedService[]>([])

  useEffect(() => {
    Promise.all([
      sosmedHeroSlideService.adminList(),
      sosmedService.adminList({ include_inactive: true }),
    ]).then(([heroRes, svcRes]) => {
      if (heroRes.success && heroRes.data?.length) {
        const first = heroRes.data[0]
        setSlide(first)
        setCodes((first.featured_service_codes || []).join(', '))
      }
      if (svcRes.success) setServices(svcRes.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const parsedCodes = useMemo(() =>
    codes.split(',').map(s => s.trim()).filter(Boolean),
    [codes]
  )

  const previewCards = useMemo(() => {
    if (!parsedCodes.length || !services.length) return []
    const codeSet = new Set(parsedCodes)
    try {
      return buildSosmedServiceCards(services).filter(c => codeSet.has(c.code))
    } catch { return [] }
  }, [parsedCodes, services])

  const handleSave = async () => {
    setSaving(true); setMsg('')
    const parsed = parsedCodes
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
      {previewCards.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {previewCards.map((card) => (
            <div key={card.key} className="flex items-center gap-2 rounded-xl bg-[#F7F7F5] p-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/5">
                <Package className="h-4 w-4 text-[#666]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-[#141414]">{card.buyerTitle}</p>
                <p className="truncate text-[10px] text-[#888]">{card.platform} • {card.priceLabel}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mb-1 text-[10px] text-[#aaa]">Services: {services.length} | Codes: {parsedCodes.join(', ') || '(kosong)'}</p>
      {parsedCodes.length > 0 && previewCards.length < parsedCodes.length && (
        <p className="mb-2 text-[10px] font-semibold text-amber-600">
          {parsedCodes.length - previewCards.length} kode tidak ditemukan: {parsedCodes.filter(c => !previewCards.some(p => p.code === c)).join(', ')}
        </p>
      )}
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
