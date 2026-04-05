"use client"

interface AdminTopbarProps {
  title: string
  sub: string
  onNavigate: (page: string) => void
}

export default function AdminTopbar({ title, sub, onNavigate }: AdminTopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="topbar-right">
        <button className="notif-btn">🔔<span className="notif-dot" /></button>
        <button className="topbar-btn" onClick={() => onNavigate('stok')}>+ Tambah Stok</button>
        <button className="topbar-btn primary" onClick={() => onNavigate('produk')}>+ Produk Baru</button>
      </div>
    </div>
  )
}
