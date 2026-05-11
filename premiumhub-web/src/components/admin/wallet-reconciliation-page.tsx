"use client"

import { AUDIT_REPORT_LIMIT } from '@/config/pagination'
import { useCallback, useEffect, useState } from 'react'

import {
  type WalletReconciliationFilters,
  type WalletReconciliationIssue,
  type WalletReconciliationReport,
  walletReconciliationService,
} from '@/services/walletReconciliationService'

const DEFAULT_FILTERS: WalletReconciliationFilters = { limit: AUDIT_REPORT_LIMIT }

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function issueLabel(type: string) {
  const labels: Record<string, string> = {
    paid_missing_debit: 'Paid tanpa debit',
    terminal_missing_refund: 'Terminal tanpa refund',
    duplicate_refund: 'Refund dobel',
    payment_order_mismatch: 'Status mismatch',
  }
  return labels[type] || type
}

export default function WalletReconciliationPage() {
  const [filters, setFilters] = useState<WalletReconciliationFilters>(DEFAULT_FILTERS)
  const [report, setReport] = useState<WalletReconciliationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [repairingKey, setRepairingKey] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const loadReport = useCallback(async (nextFilters = filters) => {
    setLoading(true)
    setError('')
    try {
      const data = await walletReconciliationService.getReport(nextFilters)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekonsiliasi wallet')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void loadReport(DEFAULT_FILTERS)
  }, [loadReport])

  const updateFilter = (key: keyof WalletReconciliationFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: key === 'limit' ? Number(value) || 200 : value || undefined }))
  }

  const applyFilters = () => {
    void loadReport(filters)
  }

  const exportEvidence = async () => {
    setExporting(true)
    setError('')
    try {
      const blob = await walletReconciliationService.exportCsv(filters)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `wallet-reconciliation-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal export evidence rekonsiliasi')
    } finally {
      setExporting(false)
    }
  }

  const repairIssue = async (issue: WalletReconciliationIssue) => {
    if (!issue.repairable || !issue.repair_action) return
    const ok = window.confirm(`Repair aman untuk ${issueLabel(issue.type)}? Sistem akan cek ulang guard dan buat refund hanya kalau belum ada.`)
    if (!ok) return
    setRepairingKey(issue.key)
    setError('')
    try {
      const result = await walletReconciliationService.repair(issue.key, issue.repair_action)
      window.alert(result.message)
      await loadReport(filters)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair gagal')
    } finally {
      setRepairingKey(null)
    }
  }

  const summary = report?.summary

  const statCards = [
    { label: 'Total Issue', value: summary?.total_issues ?? 0, tone: 'danger' },
    { label: 'Paid tanpa debit', value: summary?.paid_missing_debit ?? 0 },
    { label: 'Terminal tanpa refund', value: summary?.terminal_missing_refund ?? 0 },
    { label: 'Refund dobel', value: summary?.duplicate_refund ?? 0 },
    { label: 'Status mismatch', value: summary?.payment_order_mismatch ?? 0 },
  ]

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="overflow-hidden rounded-[28px] border border-[#FFE0D4] bg-gradient-to-br from-[#FFF7F3] via-white to-[#F7F7F5] p-6 shadow-[0_24px_70px_rgba(20,20,20,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-[#FF5733]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-[#FF5733]">Money Safety</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#141414] lg:text-4xl">Wallet Reconciliation</h1>
            <p className="mt-2 text-sm leading-6 text-[#66615D] lg:text-base">Audit order wallet sosmed: debit hilang, refund hilang/dobel, dan status payment yang tidak sinkron.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-2xl border border-[#E7E1DC] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] shadow-sm transition hover:border-[#FF5733] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void exportEvidence()} disabled={loading || exporting}>
              {exporting ? 'Exporting...' : 'Export Evidence CSV'}
            </button>
            <button type="button" className="rounded-2xl bg-[#FF5733] px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_32px_rgba(255,87,51,0.28)] transition hover:bg-[#E84926] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void loadReport(filters)} disabled={loading}>
              {loading ? 'Memuat...' : 'Refresh Report'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#EEE7E2] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#141414]">Filter audit</h2>
            <p className="text-sm text-[#77716C]">Persempit laporan berdasarkan tanggal, user, order, dan limit data.</p>
          </div>
          <button type="button" className="rounded-xl border border-[#E7E1DC] px-4 py-2 text-sm font-bold text-[#141414] transition hover:border-[#FF5733] disabled:opacity-60" onClick={applyFilters} disabled={loading}>Apply</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">Dari<input className="w-full rounded-2xl border border-[#E7E1DC] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#141414] outline-none transition focus:border-[#FF5733] focus:bg-white" type="date" value={filters.from || ''} onChange={(e) => updateFilter('from', e.target.value)} /></label>
          <label className="space-y-2 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">Sampai<input className="w-full rounded-2xl border border-[#E7E1DC] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#141414] outline-none transition focus:border-[#FF5733] focus:bg-white" type="date" value={filters.to || ''} onChange={(e) => updateFilter('to', e.target.value)} /></label>
          <label className="space-y-2 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">User ID<input className="w-full rounded-2xl border border-[#E7E1DC] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#141414] outline-none transition focus:border-[#FF5733] focus:bg-white" value={filters.user_id || ''} onChange={(e) => updateFilter('user_id', e.target.value)} placeholder="UUID user" /></label>
          <label className="space-y-2 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">Order ID<input className="w-full rounded-2xl border border-[#E7E1DC] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#141414] outline-none transition focus:border-[#FF5733] focus:bg-white" value={filters.order_id || ''} onChange={(e) => updateFilter('order_id', e.target.value)} placeholder="UUID order" /></label>
          <label className="space-y-2 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">Limit<input className="w-full rounded-2xl border border-[#E7E1DC] bg-[#FAFAF8] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-[#141414] outline-none transition focus:border-[#FF5733] focus:bg-white" type="number" min={1} max={1000} value={filters.limit || 200} onChange={(e) => updateFilter('limit', e.target.value)} /></label>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <div key={stat.label} className={`rounded-[22px] border bg-white p-5 shadow-sm ${stat.tone === 'danger' ? 'border-[#FFD5C8]' : 'border-[#EEE7E2]'}`}>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#88817C]">{stat.label}</span>
            <strong className={`mt-3 block text-3xl font-black ${stat.tone === 'danger' ? 'text-[#FF5733]' : 'text-[#141414]'}`}>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-[#EEE7E2] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#EEE7E2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#141414]">Issue Detail</h2>
            <p className="text-sm text-[#77716C]">Daftar anomali ledger/order yang perlu dicek.</p>
          </div>
          <span className="rounded-full bg-[#F7F7F5] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">{loading ? 'Scanning...' : `${report?.issues.length ?? 0} issue`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#EEE7E2] text-left text-sm">
            <thead className="bg-[#FAFAF8] text-xs font-black uppercase tracking-[0.16em] text-[#77716C]">
              <tr>
                <th className="px-5 py-4">Issue</th>
                <th className="px-5 py-4">Order</th>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Ledger</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE7] text-[#141414]">
              {(report?.issues || []).map((issue) => (
                <tr key={issue.key} className="align-top hover:bg-[#FFF8F4]">
                  <td className="px-5 py-4"><strong className="block font-black">{issueLabel(issue.type)}</strong><small className="mt-1 block max-w-sm text-xs leading-5 text-[#77716C]">{issue.description}</small></td>
                  <td className="px-5 py-4"><code className="rounded-lg bg-[#F7F7F5] px-2 py-1 text-xs">{issue.order_id}</code></td>
                  <td className="px-5 py-4"><code className="rounded-lg bg-[#F7F7F5] px-2 py-1 text-xs">{issue.user_id}</code></td>
                  <td className="px-5 py-4 font-semibold text-[#4B4743]">{issue.payment_status} / {issue.order_status}</td>
                  <td className="px-5 py-4 font-black">{formatCurrency(issue.amount)}</td>
                  <td className="px-5 py-4"><small className="text-xs text-[#77716C]">{issue.expected_ref || issue.ledger_refs?.join(', ') || '-'}</small></td>
                  <td className="px-5 py-4">
                    {issue.repairable ? (
                      <button type="button" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60" disabled={repairingKey === issue.key} onClick={() => void repairIssue(issue)}>
                        {repairingKey === issue.key ? 'Repairing...' : 'Repair Guarded'}
                      </button>
                    ) : <span className="text-xs font-bold text-[#88817C]">Audit manual</span>}
                  </td>
                </tr>
              ))}
              {!loading && (report?.issues.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center"><div className="mx-auto max-w-sm rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">Aman, tidak ada issue pada filter ini.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
