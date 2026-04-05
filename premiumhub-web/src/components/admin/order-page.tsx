"use client"

export default function OrderPage() {
  const ORDERS = [
    { id: '#4821', buyer: 'Budi S.', email: 'budi@gmail.com', product: '🎬 Netflix', paket: '1 Bulan', total: 'Rp 25.000', tgl: '4 Apr 2026', status: 'Lunas', statusClass: 's-lunas' },
    { id: '#4820', buyer: 'Rina A.', email: 'rina@gmail.com', product: '🎵 Spotify', paket: '1 Bulan', total: 'Rp 18.000', tgl: '4 Apr 2026', status: 'Pending', statusClass: 's-pending', actionClass: 'orange', actionLabel: 'Konfirmasi' },
    { id: '#4819', buyer: 'Dian P.', email: 'dian@gmail.com', product: '🎮 Xbox', paket: '1 Bulan', total: 'Rp 45.000', tgl: '3 Apr 2026', status: 'Lunas', statusClass: 's-lunas' },
    { id: '#4818', buyer: 'Fajar M.', email: 'fajar@gmail.com', product: '✨ Disney+', paket: '1 Bulan', total: 'Rp 20.000', tgl: '3 Apr 2026', status: 'Gagal', statusClass: 's-gagal' },
  ]

  return (
    <div className="page">
      <div className="card">
        <div className="card-header"><h2>Semua Order</h2><div style={{ display: 'flex', gap: 8 }}><button className="topbar-btn">Export CSV</button><button className="topbar-btn primary">Filter</button></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Pembeli</th><th>Produk</th><th>Paket</th><th>Total</th><th>Tgl Order</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {ORDERS.map((o) => (
                <tr key={o.id}>
                  <td><div className="order-id">{o.id}</div></td>
                  <td><div className="order-buyer">{o.buyer}</div><div className="order-email">{o.email}</div></td>
                  <td><span className="product-pill">{o.product}</span></td>
                  <td>{o.paket}</td>
                  <td style={{ fontWeight: 600 }}>{o.total}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{o.tgl}</td>
                  <td><span className={`status-badge ${o.statusClass}`}>{o.status}</span></td>
                  <td><button className={`action-btn${o.actionClass ? ` ${o.actionClass}` : ''}`}>{o.actionLabel || 'Detail'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
