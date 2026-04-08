"use client"

import Link from 'next/link'
import { useState } from 'react'

type PricingRule = {
  asset: 'pulsa' | 'paypal' | 'crypto'
  label: string
  rate: number
  adminFee: number
  riskFee: number
  guestSurcharge: number
  enabled: boolean
}

const INITIAL_RULES: PricingRule[] = [
  {
    asset: 'pulsa',
    label: 'Pulsa',
    rate: 0.85,
    adminFee: 2500,
    riskFee: 0,
    guestSurcharge: 3000,
    enabled: true,
  },
  {
    asset: 'paypal',
    label: 'PayPal',
    rate: 0.9,
    adminFee: 5000,
    riskFee: 3000,
    guestSurcharge: 0,
    enabled: true,
  },
  {
    asset: 'crypto',
    label: 'Crypto',
    rate: 0.92,
    adminFee: 6000,
    riskFee: 5000,
    guestSurcharge: 0,
    enabled: true,
  },
]

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ConvertPricingPage() {
  const [rules, setRules] = useState<PricingRule[]>(INITIAL_RULES)
  const [notice, setNotice] = useState('')

  const updateRule = <K extends keyof PricingRule>(index: number, key: K, value: PricingRule[K]) => {
    setRules((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)))
  }

  const saveDraft = () => {
    setNotice('Draft pricing convert berhasil disimpan.')
  }

  const publishPricing = () => {
    setNotice('Pricing convert dipublish ke sistem.')
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
        <div className="alert-bar" style={{ marginBottom: 14 }}>
          ℹ️ <strong>Tips:</strong> perubahan pricing sebaiknya dipublish di jam traffic rendah supaya tidak memicu mismatch quote.
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <h2>Pricing Rules per Aset</h2>
            <div className="card-header-right" style={{ display: 'flex', gap: 8 }}>
              <Link href="/admin/convert" className="topbar-btn">Overview</Link>
              <Link href="/admin/convert/orders" className="topbar-btn">Queue</Link>
              <Link href="/admin/convert/limits" className="topbar-btn">Limits</Link>
            </div>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {rules.map((rule, index) => (
              <div
                key={rule.asset}
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>{rule.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      Simulasi guest surcharge: {formatRupiah(rule.guestSurcharge)}
                    </div>
                  </div>

                  <label className="toggle" aria-label={`Aktifkan ${rule.label}`}>
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
                      value={rule.adminFee}
                      onChange={(event) => updateRule(index, 'adminFee', Number(event.target.value) || 0)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Risk Fee</label>
                    <input
                      className="form-input"
                      type="number"
                      value={rule.riskFee}
                      onChange={(event) => updateRule(index, 'riskFee', Number(event.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-row-2" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label className="form-label">Guest Surcharge</label>
                    <input
                      className="form-input"
                      type="number"
                      value={rule.guestSurcharge}
                      onChange={(event) => updateRule(index, 'guestSurcharge', Number(event.target.value) || 0)}
                    />
                  </div>

                  <div
                    style={{
                      border: '1px dashed var(--border)',
                      borderRadius: 9,
                      padding: '8px 10px',
                      fontSize: 12,
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    Status channel: <strong style={{ marginLeft: 4, color: 'var(--dark)' }}>{rule.enabled ? 'Aktif' : 'Nonaktif'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="topbar-btn" onClick={saveDraft}>Simpan Draft</button>
          <button className="topbar-btn primary" onClick={publishPricing}>Publish Pricing</button>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Pricing Convert</div>
            <div className="mobile-page-subtitle">Atur fee & rate per aset</div>
          </div>
          <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
        </div>

        <div className="mobile-card-list">
          {rules.map((rule, index) => (
            <article className="mobile-card" key={rule.asset}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{rule.label}</div>
                  <div className="mobile-card-sub">Surcharge tamu: {formatRupiah(rule.guestSurcharge)}</div>
                </div>
                <label className="toggle" aria-label={`Toggle ${rule.label}`}>
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
                  value={rule.rate}
                  onChange={(event) => updateRule(index, 'rate', Number(event.target.value) || 0)}
                  placeholder="Rate"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.adminFee}
                  onChange={(event) => updateRule(index, 'adminFee', Number(event.target.value) || 0)}
                  placeholder="Admin Fee"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.riskFee}
                  onChange={(event) => updateRule(index, 'riskFee', Number(event.target.value) || 0)}
                  placeholder="Risk Fee"
                />
                <input
                  className="form-input"
                  type="number"
                  value={rule.guestSurcharge}
                  onChange={(event) => updateRule(index, 'guestSurcharge', Number(event.target.value) || 0)}
                  placeholder="Guest Surcharge"
                />
              </div>
            </article>
          ))}
        </div>

        <div className="mobile-card" style={{ marginTop: 8 }}>
          <div className="mobile-card-actions">
            <button className="action-btn" onClick={saveDraft}>Simpan Draft</button>
            <button className="action-btn orange" onClick={publishPricing}>Publish</button>
          </div>
        </div>
      </div>
    </div>
  )
}
