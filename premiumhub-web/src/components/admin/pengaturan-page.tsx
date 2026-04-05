"use client"

export default function PengaturanPage() {
  return (
    <div className="page">
      <div className="grid-2-eq">
        <div className="card">
          <div className="card-header"><h2>⚙️ Sistem &amp; Umum</h2></div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="form-label">Nama Toko</label><input type="text" className="form-input" defaultValue="PremiumHub" /></div>
            <div><label className="form-label">Email Admin</label><input type="text" className="form-input" defaultValue="admin@premiumhub.id" /></div>
            <div><label className="form-label">Durasi Garansi Default</label><select className="form-select"><option>1 x 24 Jam</option><option>3 x 24 Jam</option><option selected>7 Hari</option><option>30 Hari</option></select></div>
            <div><label className="form-label">Batas Stok Kritis</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="number" className="form-input" defaultValue={3} style={{ width: 80 }} /><span style={{ fontSize: 13, color: 'var(--muted)' }}>akun tersisa</span></div></div>
            <button className="topbar-btn primary" style={{ justifyContent: 'center' }}>Simpan Pengaturan</button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>📧 Template Email</h2></div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label className="form-label">Jenis Template</label><select className="form-select"><option>Email Order Berhasil</option><option>Email Pengiriman Akun</option><option>Email Garansi Disetujui</option></select></div>
            <div><label className="form-label">Subject</label><input type="text" className="form-input" defaultValue="✅ Order #{{order_id}} Berhasil — PremiumHub" /></div>
            <div><label className="form-label">Body Email</label><textarea className="form-textarea" rows={5} defaultValue={`Halo {{nama}},\nTerima kasih sudah berbelanja di PremiumHub! 🎉\n\nOrder kamu #{{order_id}} untuk produk {{produk}} telah berhasil.\nAkun akan dikirim dalam 5 menit.\n\nSalam, Tim PremiumHub`} /></div>
            <button className="topbar-btn primary" style={{ justifyContent: 'center' }}>Simpan Template</button>
          </div>
        </div>
      </div>
    </div>
  )
}
