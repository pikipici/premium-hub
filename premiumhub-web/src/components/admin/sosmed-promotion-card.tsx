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

export default function SosmedPromotionCard() {
  const [promotions, setPromotions] = useState<AdminSosmedPromotion[]>([])
  const [services, setServices] = useState<SosmedService[]>([])
  const [bundles, setBundles] = useState<AdminSosmedBundlePackage[]>([])
  const [form, setForm] = useState<PromoFormState>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

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
        }))
      )
    }
    return services.map((service) => ({
      id: service.id,
      label: `${service.title} (${formatRupiah(service.checkout_price || 0)})`,
    }))
  }, [bundles, form.target_type, services])

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
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

  return (
    <section className="mt-6 rounded-2xl border border-[#FFE2CF] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FF5733]">Promo Sosmed</p>
          <h2 className="text-xl font-black text-[#141414]">Diskon & Countdown</h2>
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
            <option value="percent">Persen</option>
            <option value="amount">Nominal</option>
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Nilai Diskon
          <input type="number" min="0" value={form.discount_value} onChange={(event) => setForm((prev) => ({ ...prev, discount_value: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border px-3 py-2" />
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void submitForm()} disabled={loading} className="rounded-full bg-[#FF5733] px-5 py-2 text-sm font-black text-white disabled:opacity-50">
          {editingId ? 'Update Promo' : 'Buat Promo'}
        </button>
        {editingId ? <button type="button" onClick={resetForm} className="rounded-full border px-5 py-2 text-sm font-bold">Batal Edit</button> : null}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="py-2">Nama</th>
              <th>Target</th>
              <th>Diskon</th>
              <th>Periode</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {promotions.map((promo) => (
              <tr key={promo.id}>
                <td className="py-3 font-bold">{promo.name}</td>
                <td>{promo.target_type === 'service' ? 'Layanan' : 'Paket'}<br /><span className="text-xs text-gray-400">{promo.target_id}</span></td>
                <td>{promo.discount_type === 'percent' ? `${promo.discount_value}%` : formatRupiah(promo.discount_value)}</td>
                <td className="text-xs text-gray-500">{new Date(promo.starts_at).toLocaleString('id-ID')}<br />{new Date(promo.ends_at).toLocaleString('id-ID')}</td>
                <td><span className={`rounded-full px-2 py-1 text-xs font-black ${promo.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{promo.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td className="space-x-2">
                  <button type="button" onClick={() => editPromo(promo)} className="font-bold text-[#FF5733]">Edit</button>
                  <button type="button" onClick={() => void toggleStatus(promo)} className="font-bold text-gray-600">{promo.is_active ? 'Disable' : 'Enable'}</button>
                </td>
              </tr>
            ))}
            {!promotions.length ? <tr><td colSpan={6} className="py-6 text-center text-gray-400">Belum ada promo</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
