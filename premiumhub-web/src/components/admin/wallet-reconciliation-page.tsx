"use client"

import { useCallback, useEffect, useState } from 'react'

import {
  type WalletReconciliationFilters,
  type WalletReconciliationIssue,
  type WalletReconciliationReport,
  walletReconciliationService,
} from '@/services/walletReconciliationService'

const DEFAULT_FILTERS: WalletReconciliationFilters = { limit: 200 }

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

  return (
    <div className="admin-page wallet-reconciliation-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Money Safety</span>
          <h1>Wallet Reconciliation</h1>
          <p>Audit order wallet sosmed: debit hilang, refund hilang/dobel, dan status payment yang tidak sinkron.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => void loadReport(filters)} disabled={loading}>
          {loading ? 'Memuat...' : 'Refresh Report'}
        </button>
      </div>

      <div className="filter-card">
        <label>
          Dari
          <input type="date" value={filters.from || ''} onChange={(e) => updateFilter('from', e.target.value)} />
        </label>
        <label>
          Sampai
          <input type="date" value={filters.to || ''} onChange={(e) => updateFilter('to', e.target.value)} />
        </label>
        <label>
          User ID
          <input value={filters.user_id || ''} onChange={(e) => updateFilter('user_id', e.target.value)} placeholder="UUID user" />
        </label>
        <label>
          Order ID
          <input value={filters.order_id || ''} onChange={(e) => updateFilter('order_id', e.target.value)} placeholder="UUID order" />
        </label>
        <label>
          Limit
          <input type="number" min={1} max={1000} value={filters.limit || 200} onChange={(e) => updateFilter('limit', e.target.value)} />
        </label>
        <button type="button" className="secondary-btn" onClick={applyFilters} disabled={loading}>Apply</button>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="stats-grid">
        <div className="stat-card danger"><span>Total Issue</span><strong>{summary?.total_issues ?? 0}</strong></div>
        <div className="stat-card"><span>Paid tanpa debit</span><strong>{summary?.paid_missing_debit ?? 0}</strong></div>
        <div className="stat-card"><span>Terminal tanpa refund</span><strong>{summary?.terminal_missing_refund ?? 0}</strong></div>
        <div className="stat-card"><span>Refund dobel</span><strong>{summary?.duplicate_refund ?? 0}</strong></div>
        <div className="stat-card"><span>Status mismatch</span><strong>{summary?.payment_order_mismatch ?? 0}</strong></div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2>Issue Detail</h2>
          <span>{loading ? 'Scanning...' : `${report?.issues.length ?? 0} issue`}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Order</th>
                <th>User</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Ledger</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(report?.issues || []).map((issue) => (
                <tr key={issue.key}>
                  <td><strong>{issueLabel(issue.type)}</strong><small>{issue.description}</small></td>
                  <td><code>{issue.order_id}</code></td>
                  <td><code>{issue.user_id}</code></td>
                  <td>{issue.payment_status} / {issue.order_status}</td>
                  <td>{formatCurrency(issue.amount)}</td>
                  <td><small>{issue.expected_ref || issue.ledger_refs?.join(', ') || '-'}</small></td>
                  <td>
                    {issue.repairable ? (
                      <button type="button" className="danger-btn" disabled={repairingKey === issue.key} onClick={() => void repairIssue(issue)}>
                        {repairingKey === issue.key ? 'Repairing...' : 'Repair Guarded'}
                      </button>
                    ) : <span className="muted">Audit manual</span>}
                  </td>
                </tr>
              ))}
              {!loading && (report?.issues.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="empty-cell">Aman, tidak ada issue pada filter ini.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
