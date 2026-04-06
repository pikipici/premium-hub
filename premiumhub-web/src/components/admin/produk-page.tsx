"use client"

interface ProdukPageProps {
  onNavigate: (page: string) => void
  onEditProduk: (id: string) => void
}

const PRODUKS = [
  { id: 'netflix', icon: '🎬', name: 'Netflix Premium', sub: 'Shared 4K Ultra HD', cat: 'Streaming', price: 'Rp 39.000', stok: 18, stokColor: '#22C55E', terjual: 487, status: 'Aktif', statusClass: 's-lunas', actionLabel: 'Nonaktif', actionStyle: { color: 'var(--red)', borderColor: '#fecaca' } as React.CSSProperties },
  { id: 'spotify', icon: '🎵', name: 'Spotify Premium', sub: 'Individual 1 Bulan', cat: 'Musik', price: 'Rp 18.000', stok: 12, stokColor: '#22C55E', terjual: 341, status: 'Aktif', statusClass: 's-lunas', actionLabel: 'Nonaktif', actionStyle: { color: 'var(--red)', borderColor: '#fecaca' } as React.CSSProperties },
  { id: 'disney', icon: '✨', name: 'Disney+ Hotstar', sub: 'Premium Bundle', cat: 'Streaming', price: 'Rp 20.000', stok: 3, stokColor: '#EF4444', stokWarn: true, terjual: 152, status: 'Aktif', statusClass: 's-lunas', actionLabel: 'Nonaktif', actionStyle: { color: 'var(--red)', borderColor: '#fecaca' } as React.CSSProperties },
  { id: 'xbox', icon: '🎮', name: 'Xbox Game Pass', sub: 'Ultimate 1 Bulan', cat: 'Gaming', price: 'Rp 45.000', stok: 2, stokColor: '#EF4444', stokWarn: true, terjual: 89, status: 'Aktif', statusClass: 's-lunas', actionLabel: 'Nonaktif', actionStyle: { color: 'var(--red)', borderColor: '#fecaca' } as React.CSSProperties },
  { id: 'canva', icon: '🎨', name: 'Canva Pro', sub: 'Team 1 Bulan', cat: 'Produktivitas', price: 'Rp 30.000', stok: 7, stokColor: '#F59E0B', terjual: 198, status: 'Aktif', statusClass: 's-lunas', actionLabel: 'Nonaktif', actionStyle: { color: 'var(--red)', borderColor: '#fecaca' } as React.CSSProperties },
  { id: 'youtube', icon: '▶️', name: 'YouTube Premium', sub: 'Individual 1 Bulan', cat: 'Streaming', price: 'Rp 22.000', stok: 0, stokColor: 'var(--muted)', terjual: 106, status: 'Nonaktif', statusClass: 's-gagal', actionLabel: 'Aktifkan', actionClass: 'orange' },
]

export default function ProdukPage({ onNavigate, onEditProduk }: ProdukPageProps) {
  return (
    <div className="page">
      <div className="admin-desktop-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="🔍  Cari produk..." style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none', width: 240 }} />
            <select style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}><option>Semua Kategori</option><option>Streaming</option><option>Musik</option><option>Gaming</option><option>Produktivitas</option></select>
            <select style={{ fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--white)', outline: 'none' }}><option>Semua Status</option><option>Aktif</option><option>Nonaktif</option></select>
          </div>
          <button className="topbar-btn primary">+ Tambah Produk Baru</button>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produk</th><th>Kategori</th><th>Harga Mulai</th><th>Stok</th><th>Terjual</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {PRODUKS.map((p) => (
                  <tr key={p.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 22 }}>{p.icon}</span><div><div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.sub}</div></div></div></td>
                    <td><span className="product-pill">{p.cat}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.price}</td>
                    <td><span style={{ color: p.stokColor, fontWeight: 600 }}>{p.stok}{p.stokWarn ? ' ⚠' : ''}</span></td>
                    <td>{p.terjual}</td>
                    <td><span className={`status-badge ${p.statusClass}`}>{p.status}</span></td>
                    <td><div style={{ display: 'flex', gap: 6 }}><button className="action-btn" onClick={() => onEditProduk(p.id)}>✏ Edit</button><button className={`action-btn${p.actionClass ? ` ${p.actionClass}` : ''}`} style={p.actionStyle} onClick={() => {}}>{p.actionLabel}</button></div></td>
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
            <div className="mobile-page-title">Produk</div>
            <div className="mobile-page-subtitle">Kelola katalog premium</div>
          </div>
          <button className="mobile-chip-btn primary" onClick={() => onNavigate('produk')}>+ Baru</button>
        </div>

        <div className="mobile-card-list">
          {PRODUKS.map((p) => (
            <article className="mobile-card" key={p.id}>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{p.icon} {p.name}</div>
                  <div className="mobile-card-sub">{p.sub}</div>
                </div>
                <span className={`status-badge ${p.statusClass}`}>{p.status}</span>
              </div>

              <div className="mobile-card-row">
                <span className="mobile-card-label">Kategori</span>
                <span className="mobile-card-value">{p.cat}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Harga</span>
                <span className="mobile-card-value">{p.price}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Stok / Terjual</span>
                <span className="mobile-card-value" style={{ color: p.stokColor }}>{p.stok} / {p.terjual}</span>
              </div>

              <div className="mobile-card-actions">
                <button className="action-btn" onClick={() => onEditProduk(p.id)}>Edit</button>
                <button className={`action-btn${p.actionClass ? ` ${p.actionClass}` : ''}`} style={p.actionStyle}>{p.actionLabel}</button>
              </div>
            </article>
          ))}
        </div>

        <button className="mobile-fab" onClick={() => onNavigate('produk')}>+ Produk</button>
      </div>
    </div>
  )
}
