"use client"

export default function GaransiPage() {
  const CLAIMS = [
    { name: 'Budi Raharjo', email: 'budi@gmail.com', product: '🎬 Netflix', keluhan: '"Tidak bisa login sejak kemarin"', tgl: '4 Apr 2026' },
    { name: 'Sinta Wulan', email: 'sinta@gmail.com', product: '🎵 Spotify', keluhan: '"Password salah, tidak bisa masuk"', tgl: '3 Apr 2026' },
  ]

  return (
    <div className="page">
      <div className="card">
        <div className="card-header"><h2>Klaim Garansi</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pengguna</th><th>Produk</th><th>Keluhan</th><th>Tgl Klaim</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {CLAIMS.map((c, i) => (
                <tr key={i}>
                  <td><div className="order-buyer">{c.name}</div><div className="order-email">{c.email}</div></td>
                  <td><span className="product-pill">{c.product}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.keluhan}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{c.tgl}</td>
                  <td><span className="status-badge s-pending">Pending</span></td>
                  <td><div style={{ display: 'flex', gap: 6 }}>
                    <button className="g-approve" onClick={(e) => { const item = (e.target as HTMLElement).closest('tr') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✓ Disetujui'; }}>✓ Setujui</button>
                    <button className="g-reject" onClick={(e) => { const item = (e.target as HTMLElement).closest('tr') as HTMLElement | null; if (item) { item.style.opacity = '.4'; item.style.pointerEvents = 'none'; } (e.target as HTMLElement).textContent = '✕ Ditolak'; }}>✕ Tolak</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
