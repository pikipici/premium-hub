"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertAssetType, ConvertPricingRule } from '@/types/convert'

const ASSET_ORDER: ConvertAssetType[] = ['pulsa', 'paypal', 'crypto']

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function sortRules(rows: ConvertPricingRule[]) {
  return [...rows].sort((a, b) => ASSET_ORDER.indexOf(a.asset_type) - ASSET_ORDER.indexOf(b.asset_type))
}

function assetLabel(asset: ConvertAssetType) {
  if (asset === 'pulsa') return 'Pulsa'
  if (asset === 'paypal') return 'PayPal'
  return 'Crypto'
}

export default function ConvertPricingPage() {
  const [rules, setRules] = useState<ConvertPricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadRules = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const res = await convertService.adminGetPricingRules()
      if (!res.success) {
        setError(res.message || 'Gagal memuat pricing convert')
        return
      }
      setRules(sortRules(res.data))
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat pricing convert'))
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRules(false)
  }, [loadRules])

  const updateRule = <K extends keyof ConvertPricingRule>(index: number, key: K, value: ConvertPricingRule[K]) => {
    setRules((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  const hasRules = useMemo(() => rules.length > 0, [rules.length])

  const persistPricing = async (successMessage: string) => {
    if (!hasRules || saving) return

    setSaving(true)
    setError('')

    try {
      const res = await convertService.adminUpdatePricingRules(rules)
      if (!res.success) {
        setError(res.message || 'Gagal menyimpan pricing convert')
        return
      }

      setRules(sortRules(res.data))
      setNotice(successMessage)
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal menyimpan pricing convert'))
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = () => void persistPricing('Pricing convert berhasil disimpan.')
  const publishPricing = () => void persistPricing('Pricing convert dipublish ke sistem realtime.')

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar" style={{ marginBottom: 12 }}>
          ✅ <strong>{notice}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setNotice('')}
          >
            tutup
          </button>
        </div>
      )}

      {!!error && (
        <div className="alert-bar" style={{ marginBottom: 12, background: '#FEECEC', borderColor: '#F7C6C6', color: '#B42318' }}>
          ⚠️ <strong>{error}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setError('')}
          >
            tutup
          </button>
        </div>
      )}

      <div className="admin-desktop-only">
        <div className="alert-bar" style={{ marginBottom: 14 }}>
          ℹ️ <strong>Tips:</strong> perubahan pricing sebaiknya dipublish di jam traffic rendah supaya tidak memicu mismatch quote.
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Pricing Rules per Aset</h2>
            <div className="card-header-right" style={{ display: 'flex', gap: 8 }}>
              <button className="topbar-btn" onClick={() => void loadRules(true)} disabled={loading || refreshing}>
                {refreshing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Loader2 size={14} className="animate-spin" /> Refreshing
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCcw size={14} /> Refresh
                  </span>
                )}
              </button>
              <Link href="/admin/convert" className="topbar-btn">Overview</Link>
              <Link href="/admin/convert/orders" className="topbar-btn">Queue</Link>
              <Link href="/admin/convert/limits" className="topbar-btn">Limits</Link>
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" /> Memuat pricing convert...
              </div>
            ) : rules.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada pricing convert.</div>
            ) : (
              rules.map((rule, index) => (
                <div
                  key={rule.asset_type}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    background: 'var(--white)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>{assetLabel(rule.asset_type)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        Simulasi guest surcharge: {formatRupiah(rule.guest_surcharge)}
                      </div>
                    </div>

                    <label className="toggle" aria-label={`Aktifkan ${assetLabel(rule.asset_type)}`}>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) => updateRule(index, 'enabled', event.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  <div className="form-row-3">
                    <div className="form-field">
                      <label className="form-label">Rate</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        value={rule.rate}
                        onChange={(event) => updateRule(index, 'rate', Number(event.target.value) || 0)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Admin Fee</label>
                      <input
                        className="form-input"
                        type="number"
                        value={rule.admin_fee}
                        onChange={(event) => updateRule(index, 'admin_fee', Number(event.target.value) || 0)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Risk Fee</label>
                      <input
                        className="form-input"
                        type="number"
                        value={rule.risk_fee}
                        onChange={(event) => updateRule(index, 'risk_fee', Number(event.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="form-row-2" style={{ marginTop: 10 }}>
                    <div className="form-field">
                      <label className="form-label">Guest Surcharge</label>
                      <input
                        className="form-input"
                        type="number"
                        value={rule.guest_surcharge}
                        onChange={(event) => updateRule(index, 'guest_surcharge', Number(event.target.value) || 0)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">PPN Rate (0-1)</label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={rule.ppn_rate}
                        onChange={(event) => updateRule(index, 'ppn_rate', Number(event.target.value) || 0)}
                      />
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                        Setara {(rule.ppn_rate * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="topbar-btn" onClick={saveDraft} disabled={!hasRules || loading || saving}>
            {saving ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
          <button className="topbar-btn primary" onClick={publishPricing} disabled={!hasRules || loading || saving}>
            {saving ? 'Publishing...' : 'Publish Pricing'}
          </button>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Pricing Convert</div>
            <div className="mobile-page-subtitle">Atur fee & rate per aset</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="mobile-chip-btn" onClick={() => void loadRules(true)} disabled={loading || refreshing}>
              {refreshing ? '...' : 'Refresh'}
            </button>
            <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
          </div>
        </div>

        {loading ? (
          <article className="mobile-card" style={{ marginBottom: 8 }}>
            <div className="mobile-card-sub" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Loader2 size={14} className="animate-spin" /> Memuat pricing convert...
            </div>
          </article>
        ) : null}

        <div className="mobile-card-list">
          {rules.map((rule, index) => (
            <article className="mobile-card" key={rule.asset_type}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{assetLabel(rule.asset_type)}</div>
                  <div className="mobile-card-sub">Surcharge tamu: {formatRupiah(rule.guest_surcharge)}</div>
                </div>
                <label className="toggle" aria-label={`Toggle ${assetLabel(rule.asset_type)}`}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(index, 'enabled', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={rule.rate}
                  onChange={(event) => updateRule(index, 'rate', Number(event.target.value) || 0)}
                  placeholder="Rate"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.admin_fee}
                  onChange={(event) => updateRule(index, 'admin_fee', Number(event.target.value) || 0)}
                  placeholder="Admin Fee"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.risk_fee}
                  onChange={(event) => updateRule(index, 'risk_fee', Number(event.target.value) || 0)}
                  placeholder="Risk Fee"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.guest_surcharge}
                  onChange={(event) => updateRule(index, 'guest_surcharge', Number(event.target.value) || 0)}
                  placeholder="Guest Surcharge"
                />
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={rule.ppn_rate}
                  onChange={(event) => updateRule(index, 'ppn_rate', Number(event.target.value) || 0)}
                  placeholder="PPN Rate (0-1)"
                />
              </div>
            </article>
          ))}
        </div>

        <div className="mobile-card" style={{ marginTop: 8 }}>
          <div className="mobile-card-actions">
            <button className="action-btn" onClick={saveDraft} disabled={!hasRules || saving || loading}>Simpan Draft</button>
            <button className="action-btn orange" onClick={publishPricing} disabled={!hasRules || saving || loading}>Publish</button>
          </div>
        </div>
      </div>
    </div>
  )
}
