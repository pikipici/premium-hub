"use client"

export default function StokPage() {
  const STOKS = [
    { icon: '🎬', name: 'Netflix Premium', stok: 18, terpakai: 487, status: 'Normal', statusClass: 's-lunas', btnLabel: '+ Tambah Akun' },
    { icon: '🎵', name: 'Spotify Premium', stok: 12, terpakai: 341, status: 'Normal', statusClass: 's-lunas', btnLabel: '+ Tambah Akun' },
    { icon: '✨', name: 'Disney+ Hotstar', stok: 3, terpakai: 152, status: 'Kritis', statusClass: 's-gagal', btnLabel: '+ Tambah Segera', btnClass: 'orange' },
    { icon: '🎮', name: 'Xbox Game Pass', stok: 2, terpakai: 89, status: 'Kritis', statusClass: 's-gagal', btnLabel: '+ Tambah Segera', btnClass: 'orange' },
    { icon: '🎨', name: 'Canva Pro', stok: 7, terpakai: 198, status: 'Rendah', statusClass: 's-pending', btnLabel: '+ Tambah Akun' },
    { icon: '▶️', name: 'YouTube Premium', stok: 0, terpakai: 106, status: 'Habis', statusClass: 's-gagal', btnLabel: '+ Tambah Segera', btnClass: 'orange' },
  ]

  const stokColor = (s: number) => (s > 10 ? '#22C55E' : s > 3 ? '#F59E0B' : '#EF4444')

  return (
    <div className="page">
      <div className="admin-desktop-only">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className="topbar-btn primary">+ Tambah Stok Massal</button>
        </div>
        <div className="card">
          <div className="card-header"><h2>Manajemen Stok Akun</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produk</th><th>Stok Tersedia</th><th>Stok Terpakai</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {STOKS.map((s, i) => (
                  <tr key={i}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>{s.icon}</span> {s.name}</div></td>
                    <td style={{ fontWeight: 600, color: stokColor(s.stok) }}>{s.stok}{s.stok <= 3 && s.stok > 0 ? ' ⚠' : ''}</td>
                    <td>{s.terpakai}</td>
                    <td><span className={`status-badge ${s.statusClass}`}>{s.status}</span></td>
                    <td><button className={`action-btn${s.btnClass ? ` ${s.btnClass}` : ''}`}>{s.btnLabel}</button></td>
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
            <div className="mobile-page-title">Stok Akun</div>
            <div className="mobile-page-subtitle">Update stok real-time</div>
          </div>
          <button className="mobile-chip-btn primary">+ Massal</button>
        </div>

        <div className="mobile-card-list">
          {STOKS.map((s, i) => (
            <article className="mobile-card" key={i}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{s.icon} {s.name}</div>
                  <div className="mobile-card-sub">Terpakai {s.terpakai} akun</div>
                </div>
                <span className={`status-badge ${s.statusClass}`}>{s.status}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Stok tersedia</span>
                <span className="mobile-card-value" style={{ color: stokColor(s.stok) }}>{s.stok}</span>
              </div>

              <div className="mobile-card-actions">
                <button className={`stok-add-btn${s.btnClass ? ` ${s.btnClass}` : ''}`}>{s.btnLabel}</button>
              </div>
            </article>
          ))}
        </div>

        <button className="mobile-fab">+ Tambah Stok</button>
      </div>
    </div>
  )
}
