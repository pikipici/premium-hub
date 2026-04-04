"use client"

import { useState } from 'react'
import { claimService } from '@/services/claimService'
import type { Claim } from '@/types/order'
import { useEffect } from 'react'
import { ShieldCheck, Send } from 'lucide-react'

const REASONS = [
  { value: 'login', label: 'Tidak bisa login' },
  { value: 'password', label: 'Password berubah' },
  { value: 'kicked', label: 'Di-kick dari akun' },
  { value: 'profile', label: 'Profil hilang' },
  { value: 'quality', label: 'Kualitas tidak sesuai' },
  { value: 'other', label: 'Lainnya' },
]

export default function KlaimGaransiPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [form, setForm] = useState({ order_id: '', reason: 'login', description: '' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    claimService.list({ limit: 50 }).then(res => {
      if (res.success) setClaims(res.data)
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg({ type: '', text: '' })
    try {
      const res = await claimService.create(form)
      if (res.success) {
        setMsg({ type: 'success', text: 'Klaim berhasil diajukan!' })
        setForm({ order_id: '', reason: 'login', description: '' })
        // Refresh claims
        claimService.list({ limit: 50 }).then(r => { if (r.success) setClaims(r.data) })
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal mengajukan klaim' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6" /> Klaim Garansi
      </h1>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 mb-8">
        <h3 className="text-sm font-bold mb-4">Ajukan Klaim Baru</h3>

        {msg.text && (
          <div className={`text-sm p-3 rounded-xl mb-4 text-center font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#888] mb-1.5">Order ID</label>
            <input type="text" value={form.order_id} onChange={e => setForm({ ...form, order_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] transition-all"
              placeholder="Paste order ID kamu" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#888] mb-1.5">Alasan</label>
            <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] transition-all bg-white">
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#888] mb-1.5">Deskripsi</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] transition-all h-24 resize-none"
              placeholder="Jelaskan masalah yang kamu alami..." required />
          </div>
          <button type="submit" disabled={loading}
            className="px-6 py-3 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm flex items-center gap-2">
            {loading ? 'Mengirim...' : <><Send className="w-4 h-4" /> Kirim Klaim</>}
          </button>
        </form>
      </div>

      {/* Claims List */}
      <h3 className="text-sm font-bold mb-3">Riwayat Klaim</h3>
      {claims.length === 0 ? (
        <p className="text-sm text-[#888] text-center py-10">Belum ada klaim</p>
      ) : (
        <div className="space-y-3">
          {claims.map(claim => (
            <div key={claim.id} className="bg-white rounded-2xl border border-[#EBEBEB] p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-bold capitalize">{REASONS.find(r => r.value === claim.reason)?.label || claim.reason}</div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  claim.status === 'approved' ? 'bg-green-100 text-green-700' :
                  claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {claim.status === 'approved' ? 'Disetujui' : claim.status === 'rejected' ? 'Ditolak' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-[#888] mb-1">{claim.description}</p>
              {claim.admin_note && <p className="text-xs text-blue-600 mt-2">Admin: {claim.admin_note}</p>}
              <p className="text-[10px] text-[#ccc] mt-2">{new Date(claim.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
