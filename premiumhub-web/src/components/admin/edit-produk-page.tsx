"use client"

import { useState } from 'react'

interface ProductData {
  name: string
  tagline: string
  icon: string
  cat: string
  priceOrig: string
  price1: string
}

const PRODUCT_DATA: Record<string, ProductData> = {
  netflix:  { name: 'Netflix Premium',   tagline: 'Shared 4K Ultra HD · 1 profil aktif', icon: '🎬', cat: 'Streaming',     priceOrig: 'Rp 54.000', price1: 'Rp 39.000' },
  spotify:  { name: 'Spotify Premium',   tagline: 'Individual 1 Bulan',                  icon: '🎵', cat: 'Musik',          priceOrig: 'Rp 25.000', price1: 'Rp 18.000' },
  disney:   { name: 'Disney+ Hotstar',   tagline: 'Premium Bundle',                       icon: '✨', cat: 'Streaming',     priceOrig: 'Rp 30.000', price1: 'Rp 20.000' },
  xbox:     { name: 'Xbox Game Pass',    tagline: 'Ultimate 1 Bulan',                     icon: '🎮', cat: 'Gaming',        priceOrig: 'Rp 65.000', price1: 'Rp 45.000' },
  canva:    { name: 'Canva Pro',         tagline: 'Team 1 Bulan',                         icon: '🎨', cat: 'Produktivitas', priceOrig: 'Rp 45.000', price1: 'Rp 30.000' },
  youtube:  { name: 'YouTube Premium',   tagline: 'Individual 1 Bulan',                   icon: '▶️', cat: 'Streaming',     priceOrig: 'Rp 32.000', price1: 'Rp 22.000' },
}

const ICONS = ['🎬', '🎵', '📺', '🎮', '🎨', '▶️', '☁️', '🔐', '📧']

interface EditProdukPageProps {
  onNavigate: (page: string) => void
  showToast: (msg: string) => void
}

export default function EditProdukPage({ onNavigate, showToast }: EditProdukPageProps) {
  const [selectedIcon, setSelectedIcon] = useState('🎬')
  const [breadcrumbName, setBreadcrumbName] = useState('Netflix Premium')

  const updatePreview = () => {
    const nameEl = document.getElementById('f-name') as HTMLInputElement | null
    const taglineEl = document.getElementById('f-tagline') as HTMLInputElement | null
    const descEl = document.getElementById('f-desc') as HTMLTextAreaElement | null
    const priceOrigEl = document.getElementById('f-price-orig') as HTMLInputElement | null

    const prevName = document.getElementById('prev-name')
    const prevTagline = document.getElementById('prev-tagline')
    const prevDesc = document.getElementById('prev-desc')
    const prevPriceOrig = document.getElementById('prev-price-orig')
    const prevPrice = document.getElementById('prev-price')

    if (nameEl && prevName) prevName.textContent = nameEl.value
    if (taglineEl && prevTagline) prevTagline.textContent = taglineEl.value
    if (descEl && prevDesc) {
      const txt = descEl.value
      prevDesc.textContent = txt.length > 110 ? txt.substring(0, 110) + '...' : txt
    }
    if (priceOrigEl && prevPriceOrig) prevPriceOrig.textContent = 'Normal: ' + priceOrigEl.value

    const firstCard = document.querySelector('#durations-list .dur-editor-card')
    if (firstCard) {
      const priceInput = firstCard.querySelectorAll('.dur-input')[1] as HTMLInputElement | null
      if (priceInput && prevPrice) prevPrice.textContent = priceInput.value || '–'
    }

    const featureInputs = document.querySelectorAll('#features-list .dynamic-row input')
    const prevFeatures = document.getElementById('prev-features')
    if (prevFeatures) {
      prevFeatures.innerHTML = ''
      let shown = 0
      featureInputs.forEach((inp) => {
        const input = inp as HTMLInputElement
        if (shown < 3 && input.value.trim()) {
          prevFeatures.innerHTML += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;"><div style="width:14px;height:14px;border-radius:50%;background:#C5EFD8;display:flex;align-items:center;justify-content:center;font-size:7px;flex-shrink:0;">✓</div> ${input.value}</div>`
          shown++
        }
      })
      if (featureInputs.length > 3) {
        prevFeatures.innerHTML += `<div style="font-size:10px;color:var(--muted);margin-top:2px;">+${featureInputs.length - 3} fitur lainnya</div>`
      }
    }
  }

  const selectIcon = (icon: string) => {
    setSelectedIcon(icon)
    const iconPreview = document.getElementById('iconPreview')
    if (iconPreview) iconPreview.textContent = icon
    const prevIcon = document.getElementById('prev-icon')
    if (prevIcon) prevIcon.textContent = icon
  }

  const openEditProduk = (id: string) => {
    const d = PRODUCT_DATA[id] || PRODUCT_DATA.netflix
    const nameEl = document.getElementById('f-name') as HTMLInputElement | null
    const taglineEl = document.getElementById('f-tagline') as HTMLInputElement | null
    const priceOrigEl = document.getElementById('f-price-orig') as HTMLInputElement | null
    const catEl = document.getElementById('f-category') as HTMLSelectElement | null

    if (nameEl) nameEl.value = d.name
    if (taglineEl) taglineEl.value = d.tagline
    if (priceOrigEl) priceOrigEl.value = d.priceOrig
    if (catEl) {
      for (let i = 0; i < catEl.options.length; i++) {
        if (catEl.options[i].text === d.cat) { catEl.selectedIndex = i; break }
      }
    }

    const iconPreview = document.getElementById('iconPreview')
    if (iconPreview) iconPreview.textContent = d.icon
    setSelectedIcon(d.icon)
    setBreadcrumbName(d.name)
    updatePreview()
  }

  const saveProduct = () => {
    const nameEl = document.getElementById('f-name') as HTMLInputElement | null
    showToast('✓ Produk "' + (nameEl?.value || '') + '" berhasil disimpan')
  }

  // Expose functions globally for inline onclick handlers
  ;(window as any).__removeRow = function(el: HTMLElement) {
    const target = el.closest('.dynamic-row') || el.closest('.spec-row') || el.closest('.faq-editor-item')
    if (target) target.remove()
    else el.remove()
    updatePreview()
  }
  ;(window as any).updatePreview = updatePreview
  ;(window as any).addFeature = function() {
    const list = document.getElementById('features-list')
    if (!list) return
    if (list.children.length >= 8) { alert('Maksimal 8 fitur'); return }
    const row = document.createElement('div')
    row.className = 'dynamic-row'
    row.innerHTML = '<input type="text" class="form-input" placeholder="Fitur baru..." oninput="updatePreview()"><button class="btn-remove-row" onclick="window.__removeRow(this)">✕</button>'
    list.appendChild(row)
  }
  ;(window as any).addSpec = function() {
    const list = document.getElementById('specs-list')
    if (!list) return
    const row = document.createElement('div')
    row.className = 'spec-row'
    row.innerHTML = '<input type="text" class="form-input" placeholder="Label..."><input type="text" class="form-input" placeholder="Nilai..."><button class="btn-remove-row" onclick="window.__removeRow(this)">✕</button>'
    list.appendChild(row)
  }
  ;(window as any).addDuration = function() {
    const list = document.getElementById('durations-list')
    if (!list) return
    if (list.children.length >= 4) { alert('Maksimal 4 paket durasi'); return }
    const n = list.children.length + 1
    const card = document.createElement('div')
    card.className = 'dur-editor-card'
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;"><span style="font-size:12px;font-weight:700;">Paket ${n}</span><button class="btn-remove-row" onclick="this.closest('.dur-editor-card').remove()">✕</button></div><span class="dur-label-sm">Label</span><input type="text" class="dur-input" value=""><span class="dur-label-sm">Harga Tampil</span><input type="text" class="dur-input" value="" oninput="updatePreview()"><span class="dur-label-sm">Teks Hemat</span><input type="text" class="dur-input" value="">`
    list.appendChild(card)
  }
  ;(window as any).addTrust = function() {
    const list = document.getElementById('trust-list')
    if (!list) return
    const row = document.createElement('div')
    row.className = 'dynamic-row'
    row.innerHTML = '<input type="text" class="form-input" style="max-width:52px;" value="✨"><input type="text" class="form-input" placeholder="Teks trust..."><button class="btn-remove-row" onclick="window.__removeRow(this)">✕</button>'
    list.appendChild(row)
  }
  ;(window as any).addFaq = function() {
    const list = document.getElementById('faq-list')
    if (!list) return
    const n = list.children.length + 1
    const item = document.createElement('div')
    item.className = 'faq-editor-item'
    item.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;"><label class="form-label" style="margin:0;">Pertanyaan ${n}</label><button class="btn-remove-row" onclick="this.closest('.faq-editor-item').remove()">✕</button></div><input type="text" class="form-input" placeholder="Pertanyaan..."><textarea class="form-textarea" rows="2" placeholder="Jawaban..."></textarea>`
    list.appendChild(item)
  }

  return (
    <div className="page">
      <div className="edit-page-header">
        <div className="edit-breadcrumb">
          <a onClick={() => onNavigate('produk')}>← Produk</a>
          <span className="bc-sep"> / </span>
          <span className="bc-current" id="edit-breadcrumb-name">{breadcrumbName}</span>
        </div>
        <div className="edit-page-actions">
          <button className="topbar-btn">👁 Preview Halaman</button>
          <button className="topbar-btn primary" onClick={saveProduct}>💾 Simpan Perubahan</button>
        </div>
      </div>

      <div className="edit-layout">
        {/* LEFT: FORM */}
        <div className="edit-form-col">
          {/* 1. INFO DASAR */}
          <div className="form-section">
            <div className="form-section-header"><h3>1 · Info Dasar</h3><span className="form-section-sub">Header halaman produk</span></div>
            <div className="form-section-body">
              <div className="form-field">
                <label className="form-label">Ikon Produk</label>
                <div className="icon-picker-wrap">
                  <div className="icon-preview" id="iconPreview">{selectedIcon}</div>
                  <div className="icon-grid">
                    {ICONS.map((icon) => (
                      <div key={icon} className={`icon-opt${selectedIcon === icon ? ' selected' : ''}`} onClick={() => selectIcon(icon)}>{icon}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Nama Produk</label><input type="text" className="form-input" id="f-name" defaultValue="Netflix Premium" onInput={updatePreview} /></div>
                <div className="form-field"><label className="form-label">Tagline / Subtitle</label><input type="text" className="form-input" id="f-tagline" defaultValue="Shared 4K Ultra HD · 1 profil aktif" onInput={updatePreview} /></div>
              </div>
              <div className="form-row-3">
                <div className="form-field"><label className="form-label">Kategori</label><select className="form-select" id="f-category"><option>Streaming</option><option>Musik</option><option>Produktivitas</option><option>Gaming</option></select></div>
                <div className="form-field"><label className="form-label">Teks Badge Populer</label><input type="text" className="form-input" id="f-badge-popular" defaultValue="🔥 Terlaris" /></div>
                <div className="form-field"><label className="form-label">Teks Badge Garansi</label><input type="text" className="form-input" id="f-badge-garansi" defaultValue="🛡 Garansi 30 Hari" /></div>
              </div>
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Teks Jumlah Terjual</label><input type="text" className="form-input" defaultValue="🛒 5.800+ terjual bulan ini" /></div>
                <div className="form-field"><label className="form-label">Tampilkan Badge Populer</label><div className="toggle-wrap"><label className="toggle"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label><span className="toggle-label">Aktif</span></div></div>
              </div>
            </div>
          </div>

          {/* 2. DESKRIPSI & FITUR */}
          <div className="form-section">
            <div className="form-section-header"><h3>2 · Deskripsi &amp; Fitur</h3><span className="form-section-sub">Body utama + checklist</span></div>
            <div className="form-section-body">
              <div className="form-field">
                <label className="form-label">Deskripsi Produk</label>
                <textarea className="form-textarea" id="f-desc" rows={4} onInput={updatePreview} defaultValue="Nikmati ribuan film, serial, dan dokumenter Netflix dengan kualitas 4K Ultra HD dan audio Dolby Atmos. Akun shared premium dengan 1 profil eksklusif milikmu — tidak akan berubah atau di-reset selama masa aktif. Pengiriman otomatis dalam hitungan menit setelah pembayaran dikonfirmasi." />
              </div>
              <div className="form-field">
                <label className="form-label">Daftar Fitur (maks 8 item)</label>
                <div className="dynamic-list" id="features-list">
                  {['Kualitas 4K Ultra HD + HDR', 'Audio Dolby Atmos', '1 profil eksklusif untukmu', 'Streaming di semua perangkat', 'Pengiriman otomatis instan', 'Garansi penuh 30 hari', 'CS responsif 24/7', 'Download offline tersedia'].map((f, i) => (
                    <div className="dynamic-row" key={i}><input type="text" className="form-input" defaultValue={f} onInput={updatePreview} /><button className="btn-remove-row" onClick={(e) => { (window as any).__removeRow?.(e.currentTarget) }}>✕</button></div>
                  ))}
                </div>
                <button className="btn-add-row" onClick={() => (window as any).addFeature?.()}>+ Tambah Fitur</button>
              </div>
            </div>
          </div>

          {/* 3. SPESIFIKASI */}
          <div className="form-section">
            <div className="form-section-header"><h3>3 · Spesifikasi</h3><span className="form-section-sub">Tab Spesifikasi → tabel</span></div>
            <div className="form-section-body">
              <div className="form-field">
                <label className="form-label">Baris Spesifikasi <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(Label kiri → Nilai kanan)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 6, marginBottom: 6, padding: '0 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Label</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Nilai</span>
                  <span />
                </div>
                <div className="dynamic-list" id="specs-list">
                  {[
                    ['Jenis Akun', 'Shared Premium (bukan private)'],
                    ['Kualitas Video', '4K Ultra HD + HDR10 / Dolby Vision'],
                    ['Audio', 'Dolby Atmos · 5.1 Surround'],
                    ['Jumlah Profil', '1 profil (khusus kamu)'],
                    ['Layar Bersamaan', '1 layar aktif'],
                    ['Download Offline', 'Tersedia di mobile'],
                    ['Perangkat', 'HP, Tablet, Smart TV, PC, Laptop'],
                    ['Pengiriman', 'Otomatis · rata-rata < 5 menit'],
                    ['Garansi', '30 hari — ganti akun jika bermasalah'],
                    ['Metode Pembayaran', 'Transfer Bank · GoPay · OVO · DANA · QRIS'],
                  ].map((s, i) => (
                    <div className="spec-row" key={i}><input type="text" className="form-input" defaultValue={s[0]} /><input type="text" className="form-input" defaultValue={s[1]} /><button className="btn-remove-row" onClick={(e) => { (window as any).__removeRow?.(e.currentTarget) }}>✕</button></div>
                  ))}
                </div>
                <button className="btn-add-row" onClick={() => (window as any).addSpec?.()}>+ Tambah Baris Spek</button>
              </div>
            </div>
          </div>

          {/* 4. HARGA & DURASI */}
          <div className="form-section">
            <div className="form-section-header"><h3>4 · Harga &amp; Durasi</h3><span className="form-section-sub">Kartu pembelian kanan</span></div>
            <div className="form-section-body">
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Harga Coret (Normal)</label><input type="text" className="form-input" id="f-price-orig" defaultValue="Rp 54.000" onInput={updatePreview} /></div>
                <div className="form-field"><label className="form-label">Teks Harga per Hari</label><input type="text" className="form-input" defaultValue="≈ Rp 1.300/hari · hemat 28% vs official" /></div>
              </div>
              <div className="form-field"><label className="form-label">Teks Badge Diskon</label><input type="text" className="form-input" defaultValue="🏷 Promo aktif · hemat Rp 15.000" /></div>
              <div className="form-field">
                <label className="form-label">Paket Durasi <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(maks 4)</span></label>
                <div className="dur-editor-grid" id="durations-list">
                  {[
                    { label: '1 Bulan', price: 'Rp 39.000', hemat: '' },
                    { label: '3 Bulan', price: 'Rp 105.000', hemat: 'Hemat 10%' },
                    { label: '6 Bulan', price: 'Rp 192.000', hemat: 'Hemat 18%' },
                    { label: '12 Bulan', price: 'Rp 348.000', hemat: 'Hemat 26%' },
                  ].map((d, i) => (
                    <div className="dur-editor-card" key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}><span style={{ fontSize: 12, fontWeight: 700 }}>Paket {i + 1}</span><button className="btn-remove-row" onClick={(e) => (e.currentTarget.closest('.dur-editor-card') as HTMLElement | null)?.remove()}>✕</button></div>
                      <span className="dur-label-sm">Label</span><input type="text" className="dur-input" defaultValue={d.label} />
                      <span className="dur-label-sm">Harga Tampil</span><input type="text" className="dur-input" defaultValue={d.price} onInput={updatePreview} />
                      <span className="dur-label-sm">Teks Hemat</span><input type="text" className="dur-input" defaultValue={d.hemat} />
                    </div>
                  ))}
                </div>
                <button className="btn-add-row" onClick={() => (window as any).addDuration?.()} style={{ marginTop: 8 }}>+ Tambah Paket Durasi</button>
              </div>
            </div>
          </div>

          {/* 5. TRUST SIGNALS */}
          <div className="form-section">
            <div className="form-section-header"><h3>5 · Trust Signals</h3><span className="form-section-sub">Kartu pembelian → bawah</span></div>
            <div className="form-section-body">
              <div className="form-field">
                <label className="form-label">Item (ikon emoji + teks)</label>
                <div className="dynamic-list" id="trust-list">
                  {[
                    ['⚡', 'Pengiriman otomatis < 5 menit'],
                    ['🛡', 'Garansi penuh 30 hari'],
                    ['🔒', 'Pembayaran 100% aman'],
                    ['💬', 'CS responsif 24/7'],
                  ].map((t, i) => (
                    <div className="dynamic-row" key={i}><input type="text" className="form-input" style={{ maxWidth: 52 }} defaultValue={t[0]} /><input type="text" className="form-input" defaultValue={t[1]} /><button className="btn-remove-row" onClick={(e) => { (window as any).__removeRow?.(e.currentTarget) }}>✕</button></div>
                  ))}
                </div>
                <button className="btn-add-row" onClick={() => (window as any).addTrust?.()}>+ Tambah Item Trust</button>
              </div>
            </div>
          </div>

          {/* 6. FAQ */}
          <div className="form-section">
            <div className="form-section-header"><h3>6 · FAQ</h3><span className="form-section-sub">Tab FAQ → accordion</span></div>
            <div className="form-section-body">
              <div className="dynamic-list" id="faq-list">
                {[
                  { q: 'Apakah akun ini aman dan legal?', a: 'Akun yang kami jual adalah akun shared premium yang dibeli secara resmi. Profil yang kamu gunakan adalah milikmu sendiri dan tidak akan di-reset.' },
                  { q: 'Berapa lama proses pengiriman akun?', a: 'Pengiriman dilakukan secara otomatis setelah pembayaran dikonfirmasi. Rata-rata hanya 3–5 menit. Di jam sibuk maksimal 15 menit.' },
                  { q: 'Bagaimana jika akun bermasalah?', a: 'Kami menyediakan garansi penuh 30 hari. Jika akun bermasalah, hubungi CS kami dan akun akan diganti dalam waktu singkat.' },
                  { q: 'Bisa digunakan di perangkat apa saja?', a: 'Bisa digunakan di semua perangkat: HP (Android/iOS), Smart TV, laptop/PC, tablet, dan console gaming.' },
                ].map((faq, i) => (
                  <div className="faq-editor-item" key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><label className="form-label" style={{ margin: 0 }}>Pertanyaan {i + 1}</label><button className="btn-remove-row" onClick={(e) => (e.currentTarget.closest('.faq-editor-item') as HTMLElement | null)?.remove()}>✕</button></div>
                    <input type="text" className="form-input" defaultValue={faq.q} />
                    <textarea className="form-textarea" rows={2} defaultValue={faq.a} />
                  </div>
                ))}
              </div>
              <button className="btn-add-row" onClick={() => (window as any).addFaq?.()}>+ Tambah Pertanyaan FAQ</button>
            </div>
          </div>

          {/* 7. PENGATURAN */}
          <div className="form-section">
            <div className="form-section-header"><h3>7 · Pengaturan Produk</h3><span className="form-section-sub">Status, WA CS, Meta SEO</span></div>
            <div className="form-section-body">
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Status Produk</label><div className="toggle-wrap"><label className="toggle"><input type="checkbox" id="f-status" defaultChecked onChange={(e) => { const sl = document.getElementById('status-label'); if (sl) sl.textContent = e.target.checked ? 'Aktif — tampil di katalog' : 'Nonaktif — disembunyikan'; }} /><span className="toggle-slider" /></label><span className="toggle-label" id="status-label">Aktif — tampil di katalog</span></div></div>
                <div className="form-field"><label className="form-label">Tampilkan Tombol WA</label><div className="toggle-wrap"><label className="toggle"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label><span className="toggle-label">Aktif</span></div></div>
              </div>
              <div className="form-row-2">
                <div className="form-field"><label className="form-label">Nomor WhatsApp CS</label><input type="text" className="form-input" defaultValue="62812345678901" placeholder="62xxx..." /></div>
                <div className="form-field"><label className="form-label">Teks Tombol WA</label><input type="text" className="form-input" defaultValue="Tanya via WhatsApp" /></div>
              </div>
              <div className="form-field"><label className="form-label">Meta Deskripsi (SEO)</label><textarea className="form-textarea" rows={2} defaultValue="Beli Netflix Premium murah harga mulai Rp 39.000 dengan garansi 30 hari. Kualitas 4K Ultra HD, pengiriman otomatis." /></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingBottom: 32 }}>
            <button className="topbar-btn" onClick={() => onNavigate('produk')}>Batal</button>
            <button className="topbar-btn primary" style={{ flex: 1, justifyContent: 'center' }} onClick={saveProduct}>💾 Simpan Semua Perubahan</button>
          </div>
        </div>

        {/* RIGHT: LIVE PREVIEW */}
        <div className="preview-col">
          <div className="preview-card">
            <div className="preview-card-header">Live Preview</div>
            <div className="preview-card-body">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(20,20,20,.08)', color: 'var(--dark)', padding: '3px 8px', borderRadius: 100 }} id="prev-badge-cat">Streaming</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--orange)', color: '#fff', padding: '3px 8px', borderRadius: 100 }} id="prev-badge-popular">🔥 Terlaris</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: '#E8F9EF', color: '#1A7A3F', padding: '3px 8px', borderRadius: 100 }} id="prev-badge-garansi">🛡 Garansi</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div id="prev-icon" style={{ width: 44, height: 44, borderRadius: 12, background: '#C8E6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{selectedIcon}</div>
                <div><div id="prev-name" style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.4px' }}>Netflix Premium</div><div id="prev-tagline" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Shared 4K Ultra HD · 1 profil aktif</div></div>
              </div>
              <div id="prev-desc" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 10 }}>Nikmati ribuan film, serial, dan dokumenter Netflix dengan kualitas 4K Ultra HD...</div>
              <div id="prev-features" style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><div style={{ width: 14, height: 14, borderRadius: '50%', background: '#C5EFD8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, flexShrink: 0 }}>✓</div> Kualitas 4K Ultra HD + HDR</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><div style={{ width: 14, height: 14, borderRadius: '50%', background: '#C5EFD8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, flexShrink: 0 }}>✓</div> Audio Dolby Atmos</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}><div style={{ width: 14, height: 14, borderRadius: '50%', background: '#C5EFD8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, flexShrink: 0 }}>✓</div> 1 profil eksklusif untukmu</div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                <div id="prev-price" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.5px' }}>Rp 39.000</div>
                <div id="prev-price-orig" style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'line-through' }}>Normal: Rp 54.000</div>
              </div>
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-card-header">Kelengkapan Edit</div>
            <div className="preview-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Info Dasar</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Deskripsi &amp; Fitur</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Spesifikasi</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Harga &amp; Durasi</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Trust Signals</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> FAQ</div>
              <div className="checklist-item"><span className="checklist-dot" style={{ color: 'var(--green)' }}>●</span> Pengaturan</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ 7/7 bagian terisi</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
