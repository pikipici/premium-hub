"use client"

export default function PengaturanPage() {
  return (
    <div className="page">
      <div className="admin-desktop-only">
        <div className="grid-2-eq">
          <div className="card">
            <div className="card-header"><h2>⚙️ Sistem &amp; Umum</h2></div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="form-label">Nama Toko</label><input type="text" className="form-input" defaultValue="DigiMarket" /></div>
              <div><label className="form-label">Email Admin</label><input type="text" className="form-input" defaultValue="admin@premiumhub.id" /></div>
              <div><label className="form-label">Durasi Garansi Default</label><select className="form-select" defaultValue="7 Hari"><option>1 x 24 Jam</option><option>3 x 24 Jam</option><option>7 Hari</option><option>30 Hari</option></select></div>
              <div><label className="form-label">Batas Stok Kritis</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="number" className="form-input" defaultValue={3} style={{ width: 80 }} /><span style={{ fontSize: 13, color: 'var(--muted)' }}>akun tersisa</span></div></div>
              <button className="topbar-btn primary" style={{ justifyContent: 'center' }}>Simpan Pengaturan</button>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h2>📧 Template Email</h2></div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="form-label">Jenis Template</label><select className="form-select"><option>Email Order Berhasil</option><option>Email Pengiriman Akun</option><option>Email Garansi Disetujui</option></select></div>
              <div><label className="form-label">Subject</label><input type="text" className="form-input" defaultValue="✅ Order #{{order_id}} Berhasil — DigiMarket" /></div>
              <div><label className="form-label">Body Email</label><textarea className="form-textarea" rows={5} defaultValue={`Halo {{nama}},\nTerima kasih sudah berbelanja di DigiMarket! 🎉\n\nOrder kamu #{{order_id}} untuk produk {{produk}} telah berhasil.\nAkun akan dikirim dalam 5 menit.\n\nSalam, Tim DigiMarket`} /></div>
              <button className="topbar-btn primary" style={{ justifyContent: 'center' }}>Simpan Template</button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Pengaturan</div>
            <div className="mobile-page-subtitle">Konfigurasi utama & template</div>
          </div>
        </div>

        <div className="mobile-card-list">
          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">⚙️ Sistem & Umum</div>
                <div className="mobile-card-sub">Identitas toko dan default operasional</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="form-label">Nama Toko</label><input type="text" className="form-input" defaultValue="DigiMarket" /></div>
              <div><label className="form-label">Email Admin</label><input type="text" className="form-input" defaultValue="admin@premiumhub.id" /></div>
              <div><label className="form-label">Durasi Garansi Default</label><select className="form-select" defaultValue="7 Hari"><option>1 x 24 Jam</option><option>3 x 24 Jam</option><option>7 Hari</option><option>30 Hari</option></select></div>
              <div><label className="form-label">Batas Stok Kritis</label><input type="number" className="form-input" defaultValue={3} /></div>
              <button className="mobile-chip-btn primary" style={{ width: '100%', borderRadius: 10, padding: '9px 10px' }}>Simpan Pengaturan</button>
            </div>
          </article>

          <article className="mobile-card">
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">📧 Template Email</div>
                <div className="mobile-card-sub">Template otomatis untuk notifikasi</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="form-label">Jenis Template</label><select className="form-select"><option>Email Order Berhasil</option><option>Email Pengiriman Akun</option><option>Email Garansi Disetujui</option></select></div>
              <div><label className="form-label">Subject</label><input type="text" className="form-input" defaultValue="✅ Order #{{order_id}} Berhasil — DigiMarket" /></div>
              <div><label className="form-label">Body Email</label><textarea className="form-textarea" rows={6} defaultValue={`Halo {{nama}},\nTerima kasih sudah berbelanja di DigiMarket! 🎉\n\nOrder kamu #{{order_id}} untuk produk {{produk}} telah berhasil.\nAkun akan dikirim dalam 5 menit.\n\nSalam, Tim DigiMarket`} /></div>
              <button className="mobile-chip-btn primary" style={{ width: '100%', borderRadius: 10, padding: '9px 10px' }}>Simpan Template</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
