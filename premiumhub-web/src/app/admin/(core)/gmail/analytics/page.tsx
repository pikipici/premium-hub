"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw, TrendingUp } from 'lucide-react'

import { LOADING_COPY } from '@/lib/copy/loading'
import { formatRupiah } from '@/lib/utils'
import { gmailAdminService } from '@/services/gmailAdminService'
import type { GmailAdminAnalytics } from '@/types/gmailAdmin'

const WEEKS_OPTIONS = [4, 8, 12, 26, 52]

const formatWeekLabel = (iso: string) => {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }).format(d)
}

export default function AdminGmailAnalyticsPage() {
  const [data, setData] = useState<GmailAdminAnalytics | null>(null)
  const [weeks, setWeeks] = useState(8)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gmailAdminService.analytics(weeks)
      setData(res.data ?? null)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat analytics.')
    } finally {
      setLoading(false)
    }
  }, [weeks])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#6B6B6B]">Range:</span>
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
            className="rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] focus:border-[#141414] focus:outline-none"
          >
            {WEEKS_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w} minggu
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={fetchAll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

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

      {loading ? (
        <div
          className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]"
          role="status"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.detail}
        </div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="Inventory In" value={data.totals.inventory_in} hint="akun verified" />
            <Stat label="Inventory Out" value={data.totals.inventory_out} hint="akun sold" />
            <Stat
              label="Revenue"
              value={data.totals.revenue}
              format="rupiah"
              hint="dari buyer"
            />
            <Stat label="Cost" value={data.totals.cost} format="rupiah" hint="bayar seller" />
            <Stat
              label="Margin"
              value={data.totals.margin}
              format="rupiah"
              hint={`${data.totals.weeks} minggu`}
              tone="emerald"
            />
          </div>

          {/* Weekly table */}
          <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white">
            <header className="flex items-center justify-between border-b border-[#EBEBEB] px-5 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#141414]" />
                <h2 className="text-sm font-semibold text-[#141414]">Per minggu</h2>
              </div>
            </header>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#EBEBEB] bg-[#F7F7F5] text-xs uppercase tracking-wide text-[#6B6B6B]">
                <tr>
                  <th className="px-4 py-3">Minggu</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEB]">
                {data.weeks.map((w) => (
                  <tr key={w.week_start} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-3 text-xs text-[#6B6B6B]">{formatWeekLabel(w.week_start)}</td>
                    <td className="px-4 py-3">{w.inventory_in}</td>
                    <td className="px-4 py-3">{w.inventory_out}</td>
                    <td className="px-4 py-3">{formatRupiah(w.revenue)}</td>
                    <td className="px-4 py-3">{formatRupiah(w.cost)}</td>
                    <td className={`px-4 py-3 font-medium ${w.margin >= 0 ? 'text-[#0F705C]' : 'text-[#A6260F]'}`}>
                      {formatRupiah(w.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  format,
  tone,
}: {
  label: string
  value: number
  hint?: string
  format?: 'rupiah'
  tone?: 'emerald'
}) {
  const display = format === 'rupiah' ? formatRupiah(value) : value.toLocaleString('id-ID')
  return (
    <div className="rounded-3xl border border-[#EBEBEB] bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[#6B6B6B]">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${tone === 'emerald' ? 'text-[#0F705C]' : 'text-[#141414]'}`}>
        {display}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-[#6B6B6B]">{hint}</div>}
    </div>
  )
}
