"use client"

import { useEffect, useRef, useState } from 'react'

const CHART_DATA = [820, 1050, 740, 1240, 980, 1180, 1240]
const CHART_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export default function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [chartActiveTab, setChartActiveTab] = useState('7 Hari')
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chartRef.current && CHART_DATA.length > 0) {
      const maxVal = Math.max(...CHART_DATA)
      chartRef.current.innerHTML = ''
      CHART_DATA.forEach((v, i) => {
        const h = Math.round((v / maxVal) * 140)
        const isToday = i === CHART_DATA.length - 1
        const wrap = document.createElement('div')
        wrap.className = 'bar-wrap'
        wrap.innerHTML = `<div class="bar ${isToday ? 'highlight' : ''}" style="height:${h}px;background:${isToday ? 'var(--orange)' : 'var(--bg)'};"><div class="chart-tooltip">Rp ${v.toLocaleString('id')}</div></div><div class="bar-label">${CHART_DAYS[i]}</div>`
        chartRef.current!.appendChild(wrap)
      })
    }
  }, [chartActiveTab])

  return (
    <div className="page">
      <div className="alert-bar">
        ⚠️ <strong>3 produk stok kritis</strong> — Disney+, Xbox Game Pass, dan Canva Pro tersisa ≤ 3 akun.
        <a onClick={() => onNavigate('stok')}>Tambah stok sekarang →</a>
      </div>
      <div className="metrics">
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Pendapatan Hari Ini</span><div className="metric-icon green">💰</div></div>
          <div className="metric-value">Rp 1,24 jt</div>
          <div className="metric-change up">↑ 18% vs kemarin</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Order Baru</span><div className="metric-icon orange">🛒</div></div>
          <div className="metric-value">47</div>
          <div className="metric-change up">↑ 12 dari kemarin</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Klaim Garansi</span><div className="metric-icon red">🛡</div></div>
          <div className="metric-value">2</div>
          <div className="metric-change warn">⚠ Menunggu proses</div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="metric-label">Pengguna Aktif</span><div className="metric-icon blue">👥</div></div>
          <div className="metric-value">3.241</div>
          <div className="metric-change up">↑ 84 minggu ini</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <h2>Pendapatan</h2>
            <div className="card-header-right">
              <div className="chart-tabs">
                <button className={`chart-tab${chartActiveTab === '7 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('7 Hari')}>7 Hari</button>
                <button className={`chart-tab${chartActiveTab === '30 Hari' ? ' active' : ''}`} onClick={() => setChartActiveTab('30 Hari')}>30 Hari</button>
                <button className={`chart-tab${chartActiveTab === '3 Bulan' ? ' active' : ''}`} onClick={() => setChartActiveTab('3 Bulan')}>3 Bulan</button>
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <div className="chart-area" ref={chartRef} />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Ringkasan Bulan Ini</h2></div>
          <div className="mini-stats">
            <div className="mini-stat"><div className="mini-stat-label">Total Pendapatan</div><div className="mini-stat-value">Rp 28,4 jt</div><div className="mini-stat-sub">↑ 23% vs bulan lalu</div></div>
            <div className="mini-stat"><div className="mini-stat-label">Total Order</div><div className="mini-stat-value">1.284</div><div className="mini-stat-sub">↑ 156 order baru</div></div>
            <div className="mini-stat"><div className="mini-stat-label">Rate Klaim Garansi</div><div className="mini-stat-value">1,2%</div><div className="mini-stat-sub warn">↑ 0.3% perlu perhatian</div></div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h2>Order Terbaru</h2><div className="card-header-right"><button className="link-btn" onClick={() => onNavigate('order')}>Lihat semua →</button></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Pembeli</th><th>Produk</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                <tr><td><div className="order-id">#4821</div></td><td><div className="order-buyer">Budi S.</div><div className="order-email">budi@gmail.com</div></td><td><span className="product-pill">🎬 Netflix</span></td><td style={{ fontWeight: 600 }}>Rp 25.000</td><td><span className="status-badge s-lunas">Lunas</span></td><td><button className="action-btn">Detail</button></td></tr>
                <tr><td><div className="order-id">#4820</div></td><td><div className="order-buyer">Rina A.</div><div className="order-email">rina@gmail.com</div></td><td><span className="product-pill">🎵 Spotify</span></td><td style={{ fontWeight: 600 }}>Rp 18.000</td><td><span className="status-badge s-pending">Pending</span></td><td><button className="action-btn orange">Konfirmasi</button></td></tr>
                <tr><td><div className="order-id">#4819</div></td><td><div className="order-buyer">Dian P.</div><div className="order-email">dian@gmail.com</div></td><td><span className="product-pill">🎮 Xbox</span></td><td style={{ fontWeight: 600 }}>Rp 45.000</td><td><span className="status-badge s-lunas">Lunas</span></td><td><button className="action-btn">Detail</button></td></tr>
                <tr><td><div className="order-id">#4818</div></td><td><div className="order-buyer">Fajar M.</div><div className="order-email">fajar@gmail.com</div></td><td><span className="product-pill">✨ Disney+</span></td><td style={{ fontWeight: 600 }}>Rp 20.000</td><td><span className="status-badge s-gagal">Gagal</span></td><td><button className="action-btn">Detail</button></td></tr>
                <tr><td><div className="order-id">#4817</div></td><td><div className="order-buyer">Sari W.</div><div className="order-email">sari@gmail.com</div></td><td><span className="product-pill">🎨 Canva</span></td><td style={{ fontWeight: 600 }}>Rp 30.000</td><td><span className="status-badge s-proses">Diproses</span></td><td><button className="action-btn">Detail</button></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Status Stok</h2><button className="link-btn" onClick={() => onNavigate('stok')}>Kelola →</button></div>
          <div className="stok-list">
            <div className="stok-item"><div className="stok-icon">🎬</div><div className="stok-info"><div className="stok-name">Netflix Premium</div><div className="stok-meta">18 akun tersedia</div></div><div className="stok-bar-wrap"><div className="stok-bar-bg"><div className="stok-bar-fill" style={{ width: '72%', background: '#22C55E' }} /></div><div className="stok-count" style={{ color: '#22C55E' }}>18</div></div><button className="stok-add-btn">+ Tambah</button></div>
            <div className="stok-item"><div className="stok-icon">🎵</div><div className="stok-info"><div className="stok-name">Spotify Premium</div><div className="stok-meta">12 akun tersedia</div></div><div className="stok-bar-wrap"><div className="stok-bar-bg"><div className="stok-bar-fill" style={{ width: '48%', background: '#22C55E' }} /></div><div className="stok-count" style={{ color: '#22C55E' }}>12</div></div><button className="stok-add-btn">+ Tambah</button></div>
            <div className="stok-item"><div className="stok-icon">✨</div><div className="stok-info"><div className="stok-name">Disney+ Hotstar</div><div className="stok-meta">⚠ Stok kritis</div></div><div className="stok-bar-wrap"><div className="stok-bar-bg"><div className="stok-bar-fill" style={{ width: '12%', background: '#EF4444' }} /></div><div className="stok-count" style={{ color: '#EF4444' }}>3</div></div><button className="stok-add-btn" style={{ borderColor: '#EF4444', color: '#EF4444' }}>+ Segera</button></div>
            <div className="stok-item"><div className="stok-icon">🎮</div><div className="stok-info"><div className="stok-name">Xbox Game Pass</div><div className="stok-meta">⚠ Stok kritis</div></div><div className="stok-bar-wrap"><div className="stok-bar-bg"><div className="stok-bar-fill" style={{ width: '8%', background: '#EF4444' }} /></div><div className="stok-count" style={{ color: '#EF4444' }}>2</div></div><button className="stok-add-btn" style={{ borderColor: '#EF4444', color: '#EF4444' }}>+ Segera</button></div>
            <div className="stok-item"><div className="stok-icon">🎨</div><div className="stok-info"><div className="stok-name">Canva Pro</div><div className="stok-meta">7 akun tersedia</div></div><div className="stok-bar-wrap"><div className="stok-bar-bg"><div className="stok-bar-fill" style={{ width: '28%', background: '#F59E0B' }} /></div><div className="stok-count" style={{ color: '#F59E0B' }}>7</div></div><button className="stok-add-btn">+ Tambah</button></div>
          </div>
        </div>
      </div>

      <div className="grid-2-eq">
        <div className="card">
          <div className="card-header"><h2>Klaim Garansi Pending</h2><button className="link-btn" onClick={() => onNavigate('garansi')}>Lihat semua →</button></div>
          <div className="garansi-list">
            <div className="garansi-item"><div className="garansi-avatar" style={{ background: '#DBEAFE', color: '#1E40AF' }}>BR</div><div className="garansi-info"><div className="garansi-name">Budi Raharjo</div><div className="garansi-detail">Netflix · &quot;Tidak bisa login sejak kemarin&quot;</div></div><div className="garansi-actions"><button className="g-approve" onClick={(e) => { const item = (e.target as HTMLElement).closest('.garansi-item') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✓ Disetujui'; }}>✓ Setujui</button><button className="g-reject" onClick={(e) => { const item = (e.target as HTMLElement).closest('.garansi-item') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✕ Ditolak'; }}>✕ Tolak</button></div></div>
            <div className="garansi-item"><div className="garansi-avatar" style={{ background: '#FCE7F3', color: '#9D174D' }}>SW</div><div className="garansi-info"><div className="garansi-name">Sinta Wulan</div><div className="garansi-detail">Spotify · &quot;Password salah, tidak bisa masuk&quot;</div></div><div className="garansi-actions"><button className="g-approve" onClick={(e) => { const item = (e.target as HTMLElement).closest('.garansi-item') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✓ Disetujui'; }}>✓ Setujui</button><button className="g-reject" onClick={(e) => { const item = (e.target as HTMLElement).closest('.garansi-item') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✕ Ditolak'; }}>✕ Tolak</button></div></div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Tidak ada klaim lain saat ini</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Produk Terlaris</h2></div>
          <div className="top-prod-list">
            <div className="top-prod-item"><div className="top-prod-rank rank-1">1</div><div className="top-prod-icon">🎬</div><div className="top-prod-info"><div className="top-prod-name">Netflix Premium</div><div className="top-prod-sales">487 terjual</div></div><div className="top-prod-rev">Rp 12,2 jt</div></div>
            <div className="top-prod-item"><div className="top-prod-rank rank-2">2</div><div className="top-prod-icon">🎵</div><div className="top-prod-info"><div className="top-prod-name">Spotify Premium</div><div className="top-prod-sales">341 terjual</div></div><div className="top-prod-rev">Rp 6,1 jt</div></div>
            <div className="top-prod-item"><div className="top-prod-rank rank-3">3</div><div className="top-prod-icon">🎨</div><div className="top-prod-info"><div className="top-prod-name">Canva Pro</div><div className="top-prod-sales">198 terjual</div></div><div className="top-prod-rev">Rp 5,9 jt</div></div>
            <div className="top-prod-item"><div className="top-prod-rank">4</div><div className="top-prod-icon">✨</div><div className="top-prod-info"><div className="top-prod-name">Disney+ Hotstar</div><div className="top-prod-sales">152 terjual</div></div><div className="top-prod-rev">Rp 3,0 jt</div></div>
            <div className="top-prod-item"><div className="top-prod-rank">5</div><div className="top-prod-icon">▶️</div><div className="top-prod-info"><div className="top-prod-name">YouTube Premium</div><div className="top-prod-sales">106 terjual</div></div><div className="top-prod-rev">Rp 2,3 jt</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
