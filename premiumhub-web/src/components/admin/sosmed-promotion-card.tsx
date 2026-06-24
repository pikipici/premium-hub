"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { sosmedBundleService } from '@/services/sosmedBundleService'
import {
  sosmedService,
  type AdminSosmedPromotion,
  type AdminSosmedPromotionDiscountType,
  type AdminSosmedPromotionPayload,
  type AdminSosmedPromotionTargetType,
} from '@/services/sosmedService'
import type { AdminSosmedBundlePackage } from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

type PromoFormState = AdminSosmedPromotionPayload

const initialForm: PromoFormState = {
  name: '',
  target_type: 'service',
  target_id: '',
  discount_type: 'percent',
  discount_value: 10,
  starts_at: '',
  ends_at: '',
  is_active: true,
}

function toDatetimeLocal(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string) {
  return value ? new Date(value).toISOString() : ''
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0)
}

function isPromoExpired(promo: Pick<AdminSosmedPromotion, 'ends_at'>, nowMs: number) {
  const endsAtMs = new Date(promo.ends_at).getTime()
  return Number.isFinite(endsAtMs) && endsAtMs <= nowMs
}

function promoStatusMeta(promo: AdminSosmedPromotion, nowMs: number) {
  if (isPromoExpired(promo, nowMs)) {
    return { label: 'Kadaluarsa', className: 'bg-amber-50 text-amber-700' }
  }
  if (promo.is_active) {
    return { label: 'Aktif', className: 'bg-green-50 text-green-700' }
  }
  return { label: 'Nonaktif', className: 'bg-gray-100 text-gray-500' }
}

function calcPreview(basePrice: number, discountType: string, discountValue: number): { final: number; saved: number } | null {
  if (!basePrice || !discountValue) return null
  if (discountType === 'percent') {
    const pct = Math.min(Math.max(discountValue, 0), 100)
    const saved = Math.floor(basePrice * pct / 100)
    return { final: basePrice - saved, saved }
  }
  if (discountType === 'amount') {
    const saved = Math.min(discountValue, basePrice)
    return { final: basePrice - saved, saved }
  }
  return null
}

export default function SosmedPromotionCard() {
  const [promotions, setPromotions] = useState<AdminSosmedPromotion[]>([])
  const [services, setServices] = useState<SosmedService[]>([])
  const [bundles, setBundles] = useState<AdminSosmedBundlePackage[]>([])
  const [form, setForm] = useState<PromoFormState>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [promoRes, serviceRes, bundleRes] = await Promise.all([
        sosmedService.adminListPromotions(),
        sosmedService.adminList({ include_inactive: true }),
        sosmedBundleService.adminList({ include_inactive: true }),
      ])
      setPromotions(promoRes.data || [])
      setServices(serviceRes.data || [])
      setBundles(bundleRes.data || [])
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal memuat promo sosmed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const targetOptions = useMemo(() => {
    if (form.target_type === 'bundle_variant') {
      return bundles.flatMap((bundle) =>
        bundle.variants.map((variant) => ({
          id: variant.id,
          label: `${bundle.title} - ${variant.name} (${formatRupiah(variant.total_price)})`,
          basePrice: variant.total_price,
        }))
      )
    }
    return services.map((service) => ({
      id: service.id,
      label: `${service.title} (${formatRupiah(service.checkout_price || 0)})`,
      basePrice: service.checkout_price || 0,
    }))
  }, [bundles, form.target_type, services])

  // base price of selected target for preview
  const selectedBasePrice = useMemo(() => {
    if (!form.target_id) return 0
    return targetOptions.find((o) => o.id === form.target_id)?.basePrice ?? 0
  }, [form.target_id, targetOptions])

  const pricePreview = useMemo(() =>
    calcPreview(selectedBasePrice, form.discount_type, form.discount_value),
    [selectedBasePrice, form.discount_type, form.discount_value]
  )

  // warn if selected target already has active promo in overlapping period
  const overlapWarning = useMemo(() => {
    if (!form.target_id || !form.starts_at || !form.ends_at) return null
    const startsMs = new Date(fromDatetimeLocal(form.starts_at)).getTime()
    const endsMs = new Date(fromDatetimeLocal(form.ends_at)).getTime()
    if (Number.isNaN(startsMs) || Number.isNaN(endsMs)) return null
    const overlap = promotions.find((p) => {
      if (!p.is_active) return false
      if (p.target_id !== form.target_id) return false
      if (editingId && p.id === editingId) return false
      const pStart = new Date(p.starts_at).getTime()
      const pEnd = new Date(p.ends_at).getTime()
      return startsMs < pEnd && endsMs > pStart
    })
    return overlap ? `Produk ini sudah punya promo aktif "${overlap.name}" di periode yang overlap.` : null
  }, [form.target_id, form.starts_at, form.ends_at, promotions, editingId])

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
    setNotice('')
  }

  const submitForm = async () => {
    if (!form.name.trim() || !form.target_id || !form.starts_at || !form.ends_at) {
      setNotice('Nama promo, target, mulai, dan berakhir wajib diisi')
      return
    }
    const payload: AdminSosmedPromotionPayload = {
      ...form,
      name: form.name.trim(),
      discount_value: Number(form.discount_value),
      starts_at: fromDatetimeLocal(form.starts_at),
      ends_at: fromDatetimeLocal(form.ends_at),
      is_active: Boolean(form.is_active),
    }
    setLoading(true)
    try {
      if (editingId) {
        await sosmedService.adminUpdatePromotion(editingId, payload)
        setNotice('Promo berhasil diupdate')
      } else {
        await sosmedService.adminCreatePromotion(payload)
        setNotice('Promo berhasil dibuat')
      }
      resetForm()
      await loadData()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal menyimpan promo')
    } finally {
      setLoading(false)
    }
  }

  const editPromo = (promo: AdminSosmedPromotion) => {
    setEditingId(promo.id)
    setNotice('')
    setForm({
      name: promo.name,
      target_type: promo.target_type,
      target_id: promo.target_id,
      discount_type: promo.discount_type as AdminSosmedPromotionDiscountType,
      discount_value: promo.discount_value,
      starts_at: toDatetimeLocal(promo.starts_at),
      ends_at: toDatetimeLocal(promo.ends_at),
      is_active: promo.is_active,
    })
  }

  const toggleStatus = async (promo: AdminSosmedPromotion) => {
    setLoading(true)
    try {
      await sosmedService.adminSetPromotionStatus(promo.id, !promo.is_active)
      await loadData()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal ubah status promo')
    } finally {
      setLoading(false)
    }
  }

  const deletePromo = async (id: string) => {
    setLoading(true)
    try {
      await sosmedService.adminDeletePromotion(id)
      setDeleteConfirmId(null)
      setNotice('Promo berhasil dihapus')
      await loadData()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Gagal hapus promo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#FFE2CF] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FF5733]">Promo Sosmed</p>
          <h2 className="text-xl font-black text-[#141414]">Diskon &amp; Countdown</h2>
          <p className="text-sm text-gray-500">Setup promo untuk layanan satuan atau paket spesial. Harga checkout ikut harga promo aktif.</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="rounded-full border px-4 py-2 text-sm font-bold" disabled={loading}>
          Refresh
        </button>
      </div>

      {notice ? <div className="mb-4 rounded-xl bg-[#FFF3EF] px-4 py-3 text-sm font-bold text-[#D83A1D]">{notice}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-bold text-gray-700">
          Nama Promo
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Flash Sale Weekend" />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Target
          <select value={form.target_type} onChange={(event) => setForm((prev) => ({ ...prev, target_type: event.target.value as AdminSosmedPromotionTargetType, target_id: '' }))} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="service">Layanan Satuan</option>
            <option value="bundle_variant">Paket Spesial</option>
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700 lg:col-span-2">
          Produk
          <select value={form.target_id} onChange={(event) => setForm((prev) => ({ ...prev, target_id: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="">Pilih produk</option>
            {targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Tipe Diskon
          <select value={form.discount_type} onChange={(event) => setForm((prev) => ({ ...prev, discount_type: event.target.value as AdminSosmedPromotionDiscountType }))} className="mt-1 w-full rounded-xl border px-3 py-2">
            <option value="percent">Persen (%)</option>
            <option value="amount">Nominal (Rp)</option>
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Nilai Diskon
          <input type="number" min="0" max={form.discount_type === 'percent' ? 100 : undefined} value={form.discount_value} onChange={(event) => setForm((prev) => ({ ...prev, discount_value: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Mulai
          <input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Berakhir
          <input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
      </div>

      {/* Price preview */}
      {pricePreview && selectedBasePrice > 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm">
          <span className="font-bold text-green-700">Preview:</span>
          <span className="text-gray-500 line-through">{formatRupiah(selectedBasePrice)}</span>
          <span className="font-black text-green-700">{formatRupiah(pricePreview.final)}</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-black text-green-700">hemat {formatRupiah(pricePreview.saved)}</span>
        </div>
      ) : null}

      {/* Overlap warning */}
      {overlapWarning ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">
          ⚠ {overlapWarning}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void submitForm()} disabled={loading} className="rounded-full bg-[#FF5733] px-5 py-2 text-sm font-black text-white disabled:opacity-50">
          {editingId ? 'Update Promo' : 'Buat Promo'}
        </button>
        {editingId ? <button type="button" onClick={resetForm} className="rounded-full border px-5 py-2 text-sm font-bold">Batal Edit</button> : null}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="py-2">Nama</th>
              <th>Produk</th>
              <th>Diskon</th>
              <th>Periode</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {promotions.map((promo) => {
              const status = promoStatusMeta(promo, nowMs)
              const productName = promo.target_type === 'service'
                ? (promo.service_title || promo.target_id)
                : promo.bundle_title
                  ? `${promo.bundle_title} — ${promo.variant_name ?? ''}`
                  : promo.target_id

              return (
                <tr key={promo.id}>
                  <td className="py-3 font-bold">{promo.name}</td>
                  <td>
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500 uppercase tracking-wide mb-0.5">
                      {promo.target_type === 'service' ? 'Layanan' : 'Paket'}
                    </span>
                    <br />
                    <span className="text-xs text-gray-700 font-semibold">{productName}</span>
                  </td>
                  <td className="font-bold">{promo.discount_type === 'percent' ? `${promo.discount_value}%` : formatRupiah(promo.discount_value)}</td>
                  <td className="text-xs text-gray-500">
                    {new Date(promo.starts_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}<br />
                    {new Date(promo.ends_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td><span className={`rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span></td>
                  <td className="space-x-2">
                    <button type="button" onClick={() => editPromo(promo)} className="font-bold text-[#FF5733]">Edit</button>
                    <button type="button" onClick={() => void toggleStatus(promo)} className="font-bold text-gray-600">
                      {promo.is_active ? 'Disable' : 'Enable'}
                    </button>
                    {deleteConfirmId === promo.id ? (
                      <>
                        <button type="button" onClick={() => void deletePromo(promo.id)} disabled={loading} className="font-black text-red-600">Yakin hapus?</button>
                        <button type="button" onClick={() => setDeleteConfirmId(null)} className="font-bold text-gray-400">Batal</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirmId(promo.id)} className="font-bold text-red-400 hover:text-red-600">Hapus</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!promotions.length ? <tr><td colSpan={6} className="py-6 text-center text-gray-400">Belum ada promo</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
