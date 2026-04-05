"use client"

interface AdminSidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
}

export default function AdminSidebar({ currentPage, onNavigate }: AdminSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-text">Premium<span>Hub</span></div>
        <div className="admin-tag">Admin Panel</div>
      </div>
      <div className="nav-section">
        <span className="nav-section-label">Overview</span>
        <a className={`nav-item${currentPage === 'dashboard' ? ' active' : ''}`} onClick={() => onNavigate('dashboard')}>
          <span className="nav-icon">▦</span> Dashboard
        </a>
      </div>
      <div className="nav-section">
        <span className="nav-section-label">Katalog</span>
        <a className={`nav-item${currentPage === 'produk' ? ' active' : ''}`} onClick={() => onNavigate('produk')}>
          <span className="nav-icon">◈</span> Produk
        </a>
        <a className={`nav-item${currentPage === 'stok' ? ' active' : ''}`} onClick={() => onNavigate('stok')}>
          <span className="nav-icon">◧</span> Stok Akun
          <span className="nav-badge yellow">3</span>
        </a>
      </div>
      <div className="nav-section">
        <span className="nav-section-label">Transaksi</span>
        <a className={`nav-item${currentPage === 'order' ? ' active' : ''}`} onClick={() => onNavigate('order')}>
          <span className="nav-icon">◉</span> Order
          <span className="nav-badge">5</span>
        </a>
        <a className={`nav-item${currentPage === 'garansi' ? ' active' : ''}`} onClick={() => onNavigate('garansi')}>
          <span className="nav-icon">◌</span> Klaim Garansi
          <span className="nav-badge">2</span>
        </a>
      </div>
      <div className="nav-section">
        <span className="nav-section-label">Akun</span>
        <a className={`nav-item${currentPage === 'pengguna' ? ' active' : ''}`} onClick={() => onNavigate('pengguna')}>
          <span className="nav-icon">◎</span> Pengguna
        </a>
        <a className={`nav-item${currentPage === 'pengaturan' ? ' active' : ''}`} onClick={() => onNavigate('pengaturan')}>
          <span className="nav-icon">◫</span> Pengaturan
        </a>
      </div>
      <div className="sidebar-bottom">
        <div className="admin-profile">
          <div className="admin-avatar">A</div>
          <div>
            <div className="admin-name">Admin</div>
            <div className="admin-role">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
