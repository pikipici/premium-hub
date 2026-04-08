"use client"

import Link from 'next/link'

const MODULES = [
  {
    href: '/admin/convert/orders',
    title: 'Queue Orders',
    desc: 'Verifikasi order convert, approve/reject, dan tracking status.',
    cta: 'Buka Queue',
  },
  {
    href: '/admin/convert/pricing',
    title: 'Pricing & Fee',
    desc: 'Atur kurs, admin fee, risk fee, dan guest surcharge per aset.',
    cta: 'Atur Pricing',
  },
  {
    href: '/admin/convert/limits',
    title: 'Limits & Access',
    desc: 'Kelola min/max transaksi, limit harian, dan kebijakan guest/login.',
    cta: 'Atur Limit',
  },
]

const CHANNEL_HEALTH = [
  { name: 'Pulsa (All Operator)', status: 'Normal', className: 's-lunas', note: 'Uptime 99.8%' },
  { name: 'PayPal', status: 'Review', className: 's-proses', note: '2 transaksi hold' },
  { name: 'Crypto (USDT/BTC/ETH)', status: 'Normal', className: 's-lunas', note: 'Network fee stabil' },
]

const RECENT_EVENTS = [
  { time: '5m lalu', event: 'Order CVT-29318 disetujui', actor: 'admin@digimarket.id' },
  { time: '12m lalu', event: 'Rate PayPal diupdate', actor: 'ops-finance@digimarket.id' },
  { time: '22m lalu', event: 'Limit guest pulsa diturunkan', actor: 'risk@digimarket.id' },
]

export default function ConvertControlPage() {
  return (
    <div className="page">
      <div className="admin-desktop-only">
        <div className="metrics">
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Convert Hari Ini</span><div className="metric-icon blue">⇄</div></div>
            <div className="metric-value">126</div>
            <div className="metric-change up">↑ 18 vs kemarin</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Pending Review</span><div className="metric-icon orange">⏳</div></div>
            <div className="metric-value">14</div>
            <div className="metric-change warn">Perlu diproses cepat</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Success Rate</span><div className="metric-icon green">✓</div></div>
            <div className="metric-value">97.4%</div>
            <div className="metric-change up">↑ 0.9% minggu ini</div>
          </div>
          <div className="metric-card">
            <div className="metric-top"><span className="metric-label">Avg Processing</span><div className="metric-icon red">⏱</div></div>
            <div className="metric-value">11m</div>
            <div className="metric-change down">↓ 3m lebih cepat</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-header">
              <h2>Modul Kontrol Convert</h2>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              {MODULES.map((module) => (
                <div
                  key={module.href}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: 'var(--white)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>{module.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{module.desc}</div>
                  </div>

                  <Link href={module.href} className="action-btn" style={{ whiteSpace: 'nowrap' }}>
                    {module.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Channel Health</h2>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              {CHANNEL_HEALTH.map((item) => (
                <div
                  key={item.name}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--dark)' }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.note}</div>
                  </div>

                  <span className={`status-badge ${item.className}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Aktivitas Admin Terbaru (Convert)</h2>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aktivitas</th>
                  <th>Aktor</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_EVENTS.map((item) => (
                  <tr key={`${item.time}-${item.event}`}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{item.time}</td>
                    <td>
                      <div className="order-buyer">{item.event}</div>
                    </td>
                    <td>
                      <span className="product-pill">{item.actor}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Convert Control</div>
            <div className="mobile-page-subtitle">Kelola operasional convert dari satu tempat</div>
          </div>
          <Link href="/admin/convert/orders" className="mobile-chip-btn primary">Queue</Link>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div className="mobile-card-title">Quick Modules</div>
          <div className="mobile-card-sub">Akses modul penting admin convert</div>

          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {MODULES.map((module) => (
              <Link key={module.href} href={module.href} className="action-btn" style={{ textAlign: 'left' }}>
                {module.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="mobile-card-list">
          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">KPI Convert Hari Ini</div>
                <div className="mobile-card-sub">Snapshot operasional realtime</div>
              </div>
            </div>
            <div className="mobile-card-row"><span className="mobile-card-label">Order masuk</span><span className="mobile-card-value">126</span></div>
            <div className="mobile-card-row"><span className="mobile-card-label">Pending</span><span className="mobile-card-value">14</span></div>
            <div className="mobile-card-row"><span className="mobile-card-label">Success rate</span><span className="mobile-card-value">97.4%</span></div>
            <div className="mobile-card-row"><span className="mobile-card-label">Avg proses</span><span className="mobile-card-value">11 menit</span></div>
          </article>

          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">Channel Health</div>
                <div className="mobile-card-sub">Status layanan per channel</div>
              </div>
            </div>

            {CHANNEL_HEALTH.map((item) => (
              <div className="mobile-card-row" key={item.name}>
                <span className="mobile-card-label">{item.name}</span>
                <span className={`status-badge ${item.className}`}>{item.status}</span>
              </div>
            ))}
          </article>
        </div>
      </div>
    </div>
  )
}
