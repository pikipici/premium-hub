"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'

import { LOADING_COPY } from '@/lib/copy/loading'
import { formatDateTime, formatRupiah } from '@/lib/utils'
import { gmailAdminService } from '@/services/gmailAdminService'
import type {
  GmailAdminPricing,
  GmailAdminPricingUpdate,
  GmailDiscountTier,
} from '@/types/gmailAdmin'

interface DraftState {
  buyPrice: number
  sellPrice: number
  bulkDiscountEnabled: boolean
  tiers: GmailDiscountTier[]
  lowInventoryThreshold: number
}

function fromPricing(p: GmailAdminPricing): DraftState {
  let tiers: GmailDiscountTier[] = []
  try {
    tiers = JSON.parse(p.bulk_discount_tiers || '[]')
  } catch {
    tiers = []
  }
  return {
    buyPrice: p.buy_price,
    sellPrice: p.sell_price,
    bulkDiscountEnabled: p.bulk_discount_enabled,
    tiers,
    lowInventoryThreshold: p.low_inventory_threshold,
  }
}

export default function AdminGmailPricingPage() {
  const [pricing, setPricing] = useState<GmailAdminPricing | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchPricing = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gmailAdminService.getPricing()
      if (res.data) {
        setPricing(res.data)
        setDraft(fromPricing(res.data))
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat pricing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPricing()
  }, [fetchPricing])

  const dirty = useMemo(() => {
    if (!pricing || !draft) return false
    if (draft.buyPrice !== pricing.buy_price) return true
    if (draft.sellPrice !== pricing.sell_price) return true
    if (draft.bulkDiscountEnabled !== pricing.bulk_discount_enabled) return true
    if (draft.lowInventoryThreshold !== pricing.low_inventory_threshold) return true
    let originalTiers: GmailDiscountTier[] = []
    try {
      originalTiers = JSON.parse(pricing.bulk_discount_tiers || '[]')
    } catch {}
    return JSON.stringify(draft.tiers) !== JSON.stringify(originalTiers)
  }, [pricing, draft])

  const margin = draft ? draft.sellPrice - draft.buyPrice : 0
  const marginPct = draft && draft.sellPrice > 0 ? Math.round((margin / draft.sellPrice) * 100) : 0

  const submit = async () => {
    if (!draft) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: GmailAdminPricingUpdate = {
        buy_price: draft.buyPrice,
        sell_price: draft.sellPrice,
        bulk_discount_enabled: draft.bulkDiscountEnabled,
        bulk_discount_tiers: draft.tiers,
        low_inventory_threshold: draft.lowInventoryThreshold,
      }
      const res = await gmailAdminService.updatePricing(payload)
      if (res.data) {
        setPricing(res.data)
        setDraft(fromPricing(res.data))
      }
      setSuccess('Pricing berhasil diperbarui.')
      window.setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal update pricing.')
    } finally {
      setSaving(false)
    }
  }

  const updateTier = (idx: number, field: keyof GmailDiscountTier, value: number) => {
    if (!draft) return
    const next = [...draft.tiers]
    next[idx] = { ...next[idx], [field]: value }
    setDraft({ ...draft, tiers: next })
  }

  const addTier = () => {
    if (!draft) return
    setDraft({
      ...draft,
      tiers: [...draft.tiers, { min_qty: 10, discount_pct: 5 }],
    })
  }

  const removeTier = (idx: number) => {
    if (!draft) return
    setDraft({ ...draft, tiers: draft.tiers.filter((_, i) => i !== idx) })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {LOADING_COPY.detail}
      </div>
    )
  }

  if (!draft || !pricing) {
    return (
      <div className="rounded-3xl border border-[#FFC3B7] bg-[#FFF1ED] p-6 text-sm text-[#A6260F]">
        Pricing belum di-seed. Restart API untuk trigger ensureDefaultGmailPricing.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]"
          role="alert"
        >
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-[#D1FADF] bg-[#ECFDF5] px-4 py-3 text-sm text-[#0F705C]">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {/* Base prices */}
          <div className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
            <h2 className="text-base font-semibold text-[#141414]">Harga Dasar</h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Harga buy = berapa platform bayar ke seller saat verify. Harga sell = berapa buyer bayar ke
              platform.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                  Buy Price (Rp)
                </span>
                <input
                  type="number"
                  min={1}
                  value={draft.buyPrice}
                  onChange={(e) => setDraft({ ...draft, buyPrice: parseInt(e.target.value || '0', 10) })}
                  className="mt-1 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">
                  Sell Price (Rp)
                </span>
                <input
                  type="number"
                  min={1}
                  value={draft.sellPrice}
                  onChange={(e) => setDraft({ ...draft, sellPrice: parseInt(e.target.value || '0', 10) })}
                  className="mt-1 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm focus:border-[#141414] focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-3 rounded-2xl bg-[#F7F7F5] px-4 py-3 text-xs text-[#141414]">
              Margin per akun: <span className="font-semibold">{formatRupiah(margin)}</span>
              {' '}({marginPct}%)
            </div>
          </div>

          {/* Bulk discount */}
          <div className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#141414]">Bulk Discount</h2>
              <label className="inline-flex items-center gap-2 text-sm text-[#141414]">
                <input
                  type="checkbox"
                  checked={draft.bulkDiscountEnabled}
                  onChange={(e) => setDraft({ ...draft, bulkDiscountEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-[#EBEBEB]"
                />
                Aktifkan
              </label>
            </div>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Tier dihitung dengan urutan ascending. Tier pertama yang qty &gt;= min_qty di-pakai.
            </p>

            <div className="mt-4 space-y-2">
              {draft.tiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="text-[10px] uppercase text-[#6B6B6B]">Min Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={tier.min_qty}
                      onChange={(e) => updateTier(idx, 'min_qty', parseInt(e.target.value || '0', 10))}
                      className="mt-0.5 w-full rounded-2xl border border-[#EBEBEB] px-3 py-1.5 text-sm focus:border-[#141414] focus:outline-none"
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-[10px] uppercase text-[#6B6B6B]">Discount %</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={tier.discount_pct}
                      onChange={(e) => updateTier(idx, 'discount_pct', parseInt(e.target.value || '0', 10))}
                      className="mt-0.5 w-full rounded-2xl border border-[#EBEBEB] px-3 py-1.5 text-sm focus:border-[#141414] focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    aria-label="Hapus tier"
                    className="mt-3 rounded-full p-2 text-[#A6260F] hover:bg-[#FFE0D6]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addTier}
                className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-medium text-[#141414] hover:bg-[#F7F7F5]"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Tier
              </button>
            </div>
          </div>

          {/* Threshold */}
          <div className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
            <h2 className="text-base font-semibold text-[#141414]">Low Inventory Threshold</h2>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Worker akan log alert kalau verified inventory di bawah angka ini (cooldown 6 jam).
            </p>
            <input
              type="number"
              min={1}
              value={draft.lowInventoryThreshold}
              onChange={(e) =>
                setDraft({ ...draft, lowInventoryThreshold: parseInt(e.target.value || '0', 10) })
              }
              className="mt-3 w-full rounded-2xl border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm focus:border-[#141414] focus:outline-none sm:w-40"
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">Update Terakhir</div>
            <div className="mt-2 text-sm text-[#141414]">{formatDateTime(pricing.updated_at)}</div>
          </div>

          <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
            <button
              type="button"
              onClick={submit}
              disabled={!dirty || saving}
              className="w-full rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan…
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  Simpan Pricing
                </span>
              )}
            </button>
            {dirty && <p className="mt-2 text-xs text-[#6B6B6B]">Ada perubahan belum disimpan.</p>}
            <button
              type="button"
              onClick={() => setDraft(fromPricing(pricing))}
              disabled={!dirty || saving}
              className="mt-2 w-full rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-xs font-medium text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-50"
            >
              <RefreshCcw className="mr-1 inline h-3 w-3" />
              Reset ke Original
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
