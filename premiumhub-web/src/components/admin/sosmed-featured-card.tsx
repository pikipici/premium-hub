'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Package, Search, Save, X } from 'lucide-react'
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

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

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const parsedCodes = useMemo(() =>
    codes.split(',').map(s => s.trim()).filter(Boolean),
    [codes]
  )
  const selectedSet = useMemo(() => new Set(parsedCodes), [parsedCodes])

  const allCards = useMemo(() => {
    if (!services.length) return []
    return buildSosmedServiceCards(services)
  }, [services])

  const previewCards = useMemo(() => {
    if (!allCards.length) return []
    if (!parsedCodes.length) return allCards.slice(0, 4)
    return allCards.filter(c => selectedSet.has(c.code))
  }, [allCards, parsedCodes, selectedSet])

  const pickerCards = useMemo(() => {
    if (!search.trim()) return allCards
    const q = search.toLowerCase()
    return allCards.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.buyerTitle.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q)
    )
  }, [allCards, search])

  const toggleProduct = (code: string) => {
    const current = new Set(parsedCodes)
    if (current.has(code)) {
      current.delete(code)
    } else {
      if (current.size >= 4) return
      current.add(code)
    }
    setCodes(Array.from(current).join(', '))
  }

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
      <p className="mb-4 text-xs text-[#888]">Pilih 4 produk yang tampil sebagai card di samping hero slide halaman DigiSosmed.</p>

      {!slide ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
          Belum ada hero slide — simpan produk unggulan di bawah untuk auto-buat slide baru.
        </p>
      ) : (
        <div className="mb-3 rounded-xl bg-[#F7F7F5] p-3">
          <p className="text-xs font-semibold text-[#555]">Hero Slide: <span className="text-[#141414]">{slide.title}</span></p>
        </div>
      )}

      {/* Product picker */}
      <div className="relative mb-3" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F7F5] px-4 py-2 text-[11px] font-semibold text-[#555] ring-1 ring-inset ring-[#E5E5E5] transition hover:bg-[#EEE]"
        >
          <Search className="h-3.5 w-3.5" />
          Pilih Produk{parsedCodes.length > 0 ? ` (${parsedCodes.length}/4)` : ''}
        </button>

        {pickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-[500px] max-w-full rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-xl">
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full rounded-xl border border-[#E5E5E5] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#FF5733]"
              />
            </div>
            {/* Grid */}
            <div className="max-h-80 overflow-y-auto">
              <div className="grid grid-cols-1 gap-1">
                {pickerCards.map(card => {
                  const selected = selectedSet.has(card.code)
                  return (
                    <button
                      key={card.key}
                      onClick={() => toggleProduct(card.code)}
                      disabled={!selected && selectedSet.size >= 4}
                      className={'flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ' + (
                        selected
                          ? 'bg-[#FF5733]/10 ring-1 ring-[#FF5733]/30'
                          : 'hover:bg-[#F7F7F5]'
                      )}
                    >
                      <div className={'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ' + (selected ? 'bg-[#FF5733] text-white ring-[#FF5733]' : 'bg-white ring-black/5')}>
                        {selected ? <Check className="h-4 w-4" /> : <Package className="h-3.5 w-3.5 text-[#666]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#141414]">{card.buyerTitle}</p>
                        <p className="truncate text-[10px] text-[#888]">{card.platform} • {card.priceLabel} • <span className="font-mono">{card.code}</span></p>
                      </div>
                      {selected && (
                        <X className="h-3.5 w-3.5 shrink-0 text-[#FF5733]" />
                      )}
                    </button>
                  )
                })}
              </div>
              {!pickerCards.length && (
                <p className="py-6 text-center text-xs text-[#888]">Produk tidak ditemukan</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview cards */}
      {previewCards.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {previewCards.map((card) => (
            <div key={card.key} className="group relative flex items-center gap-2 rounded-xl bg-[#F7F7F5] p-2.5">
              {selectedSet.has(card.code) && (
                <button
                  onClick={() => toggleProduct(card.code)}
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5733] text-white opacity-0 shadow-sm transition group-hover:opacity-100"
                  aria-label={`Hapus ${card.buyerTitle}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
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
      {parsedCodes.length > 0 && previewCards.length < parsedCodes.length && (
        <p className="mb-2 text-[10px] font-semibold text-amber-600">
          {parsedCodes.length - previewCards.length} kode tidak ditemukan
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
