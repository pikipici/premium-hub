"use client"

import { useRouter } from 'next/navigation'

interface AdminTopbarProps {
  title: string
  sub: string
}

export default function AdminTopbar({ title, sub }: AdminTopbarProps) {
  const router = useRouter()

  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="topbar-right">
        <button className="notif-btn">🔔<span className="notif-dot" /></button>
        <button className="topbar-btn" onClick={() => router.push('/admin/stok')}>+ Tambah Stok</button>
        <button className="topbar-btn primary" onClick={() => router.push('/admin/produk')}>+ Produk Baru</button>
      </div>
    </div>
  )
}
