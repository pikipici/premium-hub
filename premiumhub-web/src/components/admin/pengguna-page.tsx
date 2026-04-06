"use client"

export default function PenggunaPage() {
  const USERS = [
    { name: 'Budi Santoso', email: 'budi@gmail.com', order: 12, belanja: 'Rp 284.000', terdaftar: 'Jan 2025' },
    { name: 'Rina Agustina', email: 'rina@gmail.com', order: 8, belanja: 'Rp 156.000', terdaftar: 'Feb 2025' },
    { name: 'Dian Pratiwi', email: 'dian@gmail.com', order: 5, belanja: 'Rp 98.000', terdaftar: 'Mar 2025' },
  ]

  return (
    <div className="page">
      <div className="admin-desktop-only">
        <div className="card">
          <div className="card-header"><h2>Daftar Pengguna</h2><button className="topbar-btn primary">Export</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nama</th><th>Email</th><th>Total Order</th><th>Total Belanja</th><th>Terdaftar</th><th>Status</th></tr></thead>
              <tbody>
                {USERS.map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</td>
                    <td>{u.order}</td>
                    <td style={{ fontWeight: 600 }}>{u.belanja}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{u.terdaftar}</td>
                    <td><span className="status-badge s-lunas">Aktif</span></td>
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
            <div className="mobile-page-title">Pengguna</div>
            <div className="mobile-page-subtitle">Ringkasan aktivitas pelanggan</div>
          </div>
          <button className="mobile-chip-btn">Export</button>
        </div>

        <div className="mobile-card-list">
          {USERS.map((u, i) => (
            <article className="mobile-card" key={i}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{u.name}</div>
                  <div className="mobile-card-sub">{u.email}</div>
                </div>
                <span className="status-badge s-lunas">Aktif</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Total order</span>
                <span className="mobile-card-value">{u.order}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Total belanja</span>
                <span className="mobile-card-value">{u.belanja}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Terdaftar</span>
                <span className="mobile-card-value">{u.terdaftar}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
