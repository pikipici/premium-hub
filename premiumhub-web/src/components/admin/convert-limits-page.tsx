"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

import { getHttpErrorMessage } from '@/lib/httpError'
import { convertService } from '@/services/convertService'
import type { ConvertAssetType, ConvertLimitRule } from '@/types/convert'

const ASSET_ORDER: ConvertAssetType[] = ['pulsa', 'paypal', 'crypto']

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function assetLabel(asset: ConvertAssetType) {
  if (asset === 'pulsa') return 'Pulsa'
  if (asset === 'paypal') return 'PayPal'
  return 'Crypto'
}

function sortRules(rows: ConvertLimitRule[]) {
  return [...rows].sort((a, b) => ASSET_ORDER.indexOf(a.asset_type) - ASSET_ORDER.indexOf(b.asset_type))
}

export default function ConvertLimitsPage() {
  const [limits, setLimits] = useState<ConvertLimitRule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadLimits = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const res = await convertService.adminGetLimitRules()
      if (!res.success) {
        setError(res.message || 'Gagal memuat limit convert')
        return
      }
      setLimits(sortRules(res.data))
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal memuat limit convert'))
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLimits(false)
  }, [loadLimits])

  const hasLimits = useMemo(() => limits.length > 0, [limits.length])

  const updateLimit = <K extends keyof ConvertLimitRule>(index: number, key: K, value: ConvertLimitRule[K]) => {
    setLimits((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  const saveLimits = async () => {
    if (!hasLimits || saving) return

    setSaving(true)
    setError('')

    try {
      const res = await convertService.adminUpdateLimitRules(limits)
      if (!res.success) {
        setError(res.message || 'Gagal menyimpan limit convert')
        return
      }

      setLimits(sortRules(res.data))
      setNotice('Konfigurasi limit & akses convert berhasil disimpan.')
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Gagal menyimpan limit convert'))
    } finally {
      setSaving(false)
    }
  }

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
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Limits & Access per Aset</h2>
            <div className="card-header-right" style={{ display: 'flex', gap: 8 }}>
              <button className="topbar-btn" onClick={() => void loadLimits(true)} disabled={loading || refreshing}>
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
              <Link href="/admin/convert/pricing" className="topbar-btn">Pricing</Link>
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {loading ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" /> Memuat limit convert...
              </div>
            ) : limits.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada limit convert.</div>
            ) : (
              limits.map((item, index) => (
                <div
                  key={item.asset_type}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    background: 'var(--white)',
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>{assetLabel(item.asset_type)}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      Min {formatRupiah(item.min_amount)} · Max {formatRupiah(item.max_amount)} · Daily {formatRupiah(item.daily_limit)}
                    </div>
                  </div>

                  <div className="form-row-2" style={{ marginBottom: 8 }}>
                    <label className="toggle-wrap">
                      <span className="toggle">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(event) => updateLimit(index, 'enabled', event.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </span>
                      <span className="toggle-label">Channel aktif</span>
                    </label>

                    <label className="toggle-wrap">
                      <span className="toggle">
                        <input
                          type="checkbox"
                          checked={item.allow_guest}
                          onChange={(event) => updateLimit(index, 'allow_guest', event.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </span>
                      <span className="toggle-label">Guest boleh transaksi</span>
                    </label>
                  </div>

                  <div className="form-row-2" style={{ marginBottom: 8 }}>
                    <label className="toggle-wrap">
                      <span className="toggle">
                        <input
                          type="checkbox"
                          checked={item.require_login}
                          onChange={(event) => updateLimit(index, 'require_login', event.target.checked)}
                        />
                        <span className="toggle-slider" />
                      </span>
                      <span className="toggle-label">Wajib login</span>
                    </label>
                  </div>

                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Minimal transaksi</label>
                      <input
                        className="form-input"
                        type="number"
                        value={item.min_amount}
                        onChange={(event) => updateLimit(index, 'min_amount', Number(event.target.value) || 0)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Maksimal transaksi</label>
                      <input
                        className="form-input"
                        type="number"
                        value={item.max_amount}
                        onChange={(event) => updateLimit(index, 'max_amount', Number(event.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="form-row-2" style={{ marginTop: 8 }}>
                    <div className="form-field">
                      <label className="form-label">Limit harian per user</label>
                      <input
                        className="form-input"
                        type="number"
                        value={item.daily_limit}
                        onChange={(event) => updateLimit(index, 'daily_limit', Number(event.target.value) || 0)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Manual review threshold</label>
                      <input
                        className="form-input"
                        type="number"
                        value={item.manual_review_threshold}
                        onChange={(event) => updateLimit(index, 'manual_review_threshold', Number(event.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Risk Guardrails (Informasi)</h2>
          </div>

          <div style={{ padding: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            Konfigurasi risk guardrails global (velocity, auto-hold, dan anti abuse lanjutan) dipisah ke phase 4.
            Di phase 3 ini fokus utama adalah wiring limits & access yang sudah tersedia di backend convert.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="topbar-btn primary" onClick={() => void saveLimits()} disabled={!hasLimits || loading || saving}>
            {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </button>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Limits & Access</div>
            <div className="mobile-page-subtitle">Rule guest, login, dan threshold transaksi</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="mobile-chip-btn" onClick={() => void loadLimits(true)} disabled={loading || refreshing}>
              {refreshing ? '...' : 'Refresh'}
            </button>
            <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
          </div>
        </div>

        {loading ? (
          <article className="mobile-card" style={{ marginBottom: 8 }}>
            <div className="mobile-card-sub" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Loader2 size={14} className="animate-spin" /> Memuat limit convert...
            </div>
          </article>
        ) : null}

        <div className="mobile-card-list">
          {limits.map((item, index) => (
            <article className="mobile-card" key={item.asset_type}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{assetLabel(item.asset_type)}</div>
                  <div className="mobile-card-sub">Min {formatRupiah(item.min_amount)} · Max {formatRupiah(item.max_amount)}</div>
                </div>
              </div>

              <label className="toggle-wrap" style={{ marginBottom: 8 }}>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) => updateLimit(index, 'enabled', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </span>
                <span className="toggle-label">Channel aktif</span>
              </label>

              <label className="toggle-wrap" style={{ marginBottom: 8 }}>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={item.allow_guest}
                    onChange={(event) => updateLimit(index, 'allow_guest', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </span>
                <span className="toggle-label">Guest boleh transaksi</span>
              </label>

              <label className="toggle-wrap" style={{ marginBottom: 8 }}>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={item.require_login}
                    onChange={(event) => updateLimit(index, 'require_login', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </span>
                <span className="toggle-label">Wajib login</span>
              </label>

              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  className="form-input"
                  type="number"
                  value={item.min_amount}
                  onChange={(event) => updateLimit(index, 'min_amount', Number(event.target.value) || 0)}
                  placeholder="Minimal transaksi"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.max_amount}
                  onChange={(event) => updateLimit(index, 'max_amount', Number(event.target.value) || 0)}
                  placeholder="Maksimal transaksi"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.daily_limit}
                  onChange={(event) => updateLimit(index, 'daily_limit', Number(event.target.value) || 0)}
                  placeholder="Limit harian"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.manual_review_threshold}
                  onChange={(event) => updateLimit(index, 'manual_review_threshold', Number(event.target.value) || 0)}
                  placeholder="Manual review threshold"
                />
              </div>
            </article>
          ))}

          <article className="mobile-card">
            <div className="mobile-card-title">Risk Guardrails (Info)</div>
            <div className="mobile-card-sub">
              Pengaturan risk guardrails global dipisah ke phase 4. Phase 3 fokus limit & akses convert yang sudah live.
            </div>
          </article>
        </div>

        <div className="mobile-card" style={{ marginTop: 8 }}>
          <div className="mobile-card-actions">
            <button className="action-btn orange" onClick={() => void saveLimits()} disabled={!hasLimits || loading || saving}>
              {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
