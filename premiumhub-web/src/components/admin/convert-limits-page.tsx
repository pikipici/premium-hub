"use client"

import Link from 'next/link'
import { useState } from 'react'

type AssetLimit = {
  asset: 'pulsa' | 'paypal' | 'crypto'
  label: string
  allowGuest: boolean
  requireLogin: boolean
  minAmount: number
  maxAmount: number
  dailyLimit: number
  manualReviewThreshold: number
}

type RiskSettings = {
  velocityPerHour: number
  maxFailedAttempt: number
  blockDurationMinutes: number
  autoHoldHighRisk: boolean
}

const INITIAL_LIMITS: AssetLimit[] = [
  {
    asset: 'pulsa',
    label: 'Pulsa',
    allowGuest: true,
    requireLogin: false,
    minAmount: 10000,
    maxAmount: 1000000,
    dailyLimit: 5000000,
    manualReviewThreshold: 1000000,
  },
  {
    asset: 'paypal',
    label: 'PayPal',
    allowGuest: false,
    requireLogin: true,
    minAmount: 50000,
    maxAmount: 50000000,
    dailyLimit: 100000000,
    manualReviewThreshold: 10000000,
  },
  {
    asset: 'crypto',
    label: 'Crypto',
    allowGuest: false,
    requireLogin: true,
    minAmount: 100000,
    maxAmount: 100000000,
    dailyLimit: 300000000,
    manualReviewThreshold: 15000000,
  },
]

const INITIAL_RISK: RiskSettings = {
  velocityPerHour: 12,
  maxFailedAttempt: 3,
  blockDurationMinutes: 30,
  autoHoldHighRisk: true,
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ConvertLimitsPage() {
  const [limits, setLimits] = useState<AssetLimit[]>(INITIAL_LIMITS)
  const [risk, setRisk] = useState<RiskSettings>(INITIAL_RISK)
  const [notice, setNotice] = useState('')

  const updateLimit = <K extends keyof AssetLimit>(index: number, key: K, value: AssetLimit[K]) => {
    setLimits((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  const updateRisk = <K extends keyof RiskSettings>(key: K, value: RiskSettings[K]) => {
    setRisk((prev) => ({ ...prev, [key]: value }))
  }

  const saveLimits = () => {
    setNotice('Konfigurasi limit & akses convert berhasil disimpan.')
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

      <div className="admin-desktop-only">
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Limits & Access per Aset</h2>
            <div className="card-header-right" style={{ display: 'flex', gap: 8 }}>
              <Link href="/admin/convert" className="topbar-btn">Overview</Link>
              <Link href="/admin/convert/orders" className="topbar-btn">Queue</Link>
              <Link href="/admin/convert/pricing" className="topbar-btn">Pricing</Link>
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {limits.map((item, index) => (
              <div
                key={item.asset}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'var(--white)',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Min {formatRupiah(item.minAmount)} · Max {formatRupiah(item.maxAmount)} · Daily {formatRupiah(item.dailyLimit)}
                  </div>
                </div>

                <div className="form-row-2" style={{ marginBottom: 8 }}>
                  <label className="toggle-wrap">
                    <span className="toggle">
                      <input
                        type="checkbox"
                        checked={item.allowGuest}
                        onChange={(event) => updateLimit(index, 'allowGuest', event.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </span>
                    <span className="toggle-label">Guest boleh transaksi</span>
                  </label>

                  <label className="toggle-wrap">
                    <span className="toggle">
                      <input
                        type="checkbox"
                        checked={item.requireLogin}
                        onChange={(event) => updateLimit(index, 'requireLogin', event.target.checked)}
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
                      value={item.minAmount}
                      onChange={(event) => updateLimit(index, 'minAmount', Number(event.target.value) || 0)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Maksimal transaksi</label>
                    <input
                      className="form-input"
                      type="number"
                      value={item.maxAmount}
                      onChange={(event) => updateLimit(index, 'maxAmount', Number(event.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-row-2" style={{ marginTop: 8 }}>
                  <div className="form-field">
                    <label className="form-label">Limit harian per user</label>
                    <input
                      className="form-input"
                      type="number"
                      value={item.dailyLimit}
                      onChange={(event) => updateLimit(index, 'dailyLimit', Number(event.target.value) || 0)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Manual review threshold</label>
                    <input
                      className="form-input"
                      type="number"
                      value={item.manualReviewThreshold}
                      onChange={(event) => updateLimit(index, 'manualReviewThreshold', Number(event.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Risk Guardrails (Global)</h2>
          </div>

          <div style={{ padding: 16 }}>
            <div className="form-row-3">
              <div className="form-field">
                <label className="form-label">Velocity / jam</label>
                <input
                  className="form-input"
                  type="number"
                  value={risk.velocityPerHour}
                  onChange={(event) => updateRisk('velocityPerHour', Number(event.target.value) || 0)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Max gagal berturut</label>
                <input
                  className="form-input"
                  type="number"
                  value={risk.maxFailedAttempt}
                  onChange={(event) => updateRisk('maxFailedAttempt', Number(event.target.value) || 0)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Block duration (menit)</label>
                <input
                  className="form-input"
                  type="number"
                  value={risk.blockDurationMinutes}
                  onChange={(event) => updateRisk('blockDurationMinutes', Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <label className="toggle-wrap" style={{ marginTop: 10 }}>
              <span className="toggle">
                <input
                  type="checkbox"
                  checked={risk.autoHoldHighRisk}
                  onChange={(event) => updateRisk('autoHoldHighRisk', event.target.checked)}
                />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label">Auto hold untuk order high risk</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="topbar-btn primary" onClick={saveLimits}>Simpan Konfigurasi</button>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Limits & Access</div>
            <div className="mobile-page-subtitle">Rule guest, login, dan threshold risiko</div>
          </div>
          <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
        </div>

        <div className="mobile-card-list">
          {limits.map((item, index) => (
            <article className="mobile-card" key={item.asset}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{item.label}</div>
                  <div className="mobile-card-sub">Min {formatRupiah(item.minAmount)} · Max {formatRupiah(item.maxAmount)}</div>
                </div>
              </div>

              <label className="toggle-wrap" style={{ marginBottom: 8 }}>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={item.allowGuest}
                    onChange={(event) => updateLimit(index, 'allowGuest', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </span>
                <span className="toggle-label">Guest boleh transaksi</span>
              </label>

              <label className="toggle-wrap" style={{ marginBottom: 8 }}>
                <span className="toggle">
                  <input
                    type="checkbox"
                    checked={item.requireLogin}
                    onChange={(event) => updateLimit(index, 'requireLogin', event.target.checked)}
                  />
                  <span className="toggle-slider" />
                </span>
                <span className="toggle-label">Wajib login</span>
              </label>

              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  className="form-input"
                  type="number"
                  value={item.minAmount}
                  onChange={(event) => updateLimit(index, 'minAmount', Number(event.target.value) || 0)}
                  placeholder="Minimal transaksi"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.maxAmount}
                  onChange={(event) => updateLimit(index, 'maxAmount', Number(event.target.value) || 0)}
                  placeholder="Maksimal transaksi"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.dailyLimit}
                  onChange={(event) => updateLimit(index, 'dailyLimit', Number(event.target.value) || 0)}
                  placeholder="Limit harian"
                />
                <input
                  className="form-input"
                  type="number"
                  value={item.manualReviewThreshold}
                  onChange={(event) => updateLimit(index, 'manualReviewThreshold', Number(event.target.value) || 0)}
                  placeholder="Manual review threshold"
                />
              </div>
            </article>
          ))}

          <article className="mobile-card">
            <div className="mobile-card-title">Risk Guardrails</div>
            <div className="mobile-card-sub">Konfigurasi global anti abuse</div>

            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input
                className="form-input"
                type="number"
                value={risk.velocityPerHour}
                onChange={(event) => updateRisk('velocityPerHour', Number(event.target.value) || 0)}
                placeholder="Velocity per jam"
              />
              <input
                className="form-input"
                type="number"
                value={risk.maxFailedAttempt}
                onChange={(event) => updateRisk('maxFailedAttempt', Number(event.target.value) || 0)}
                placeholder="Max gagal berturut"
              />
              <input
                className="form-input"
                type="number"
                value={risk.blockDurationMinutes}
                onChange={(event) => updateRisk('blockDurationMinutes', Number(event.target.value) || 0)}
                placeholder="Block duration (menit)"
              />
            </div>

            <label className="toggle-wrap" style={{ marginTop: 8 }}>
              <span className="toggle">
                <input
                  type="checkbox"
                  checked={risk.autoHoldHighRisk}
                  onChange={(event) => updateRisk('autoHoldHighRisk', event.target.checked)}
                />
                <span className="toggle-slider" />
              </span>
              <span className="toggle-label">Auto hold order high risk</span>
            </label>
          </article>
        </div>

        <div className="mobile-card" style={{ marginTop: 8 }}>
          <div className="mobile-card-actions">
            <button className="action-btn orange" onClick={saveLimits}>Simpan Konfigurasi</button>
          </div>
        </div>
      </div>
    </div>
  )
}
