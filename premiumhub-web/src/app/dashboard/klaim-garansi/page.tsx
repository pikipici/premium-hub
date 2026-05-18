"use client"

import { useEffect, useState } from 'react'
import { Inbox, Send, ShieldCheck } from 'lucide-react'

import { claimService } from '@/services/claimService'
import type { Claim } from '@/types/order'
import { claimTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { getHttpErrorMessage } from '@/lib/httpError'

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
    claimService
      .list({ limit: 50 })
      .then((res) => {
        if (res.success) setClaims(res.data)
      })
      .catch(() => {})
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
        claimService
          .list({ limit: 50 })
          .then((r) => {
            if (r.success) setClaims(r.data)
          })
          .catch(() => {})
      }
    } catch (err: unknown) {
      setMsg({ type: 'error', text: getHttpErrorMessage(err, 'Gagal mengajukan klaim') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-extrabold text-[#141414]">
        <ShieldCheck className="h-6 w-6 text-[#FF5733]" /> Klaim Garansi
      </h1>

      <section className="mb-6 rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] md:p-6">
        <h2 className="mb-4 text-sm font-bold text-[#141414]">Ajukan Klaim Baru</h2>

        {msg.text ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-center text-sm font-medium ${
              msg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {msg.text}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="claim-order-id" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Order ID
            </label>
            <input
              id="claim-order-id"
              type="text"
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
              className="w-full rounded-xl border border-[#EBEBEB] px-4 py-3 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
              placeholder="Paste order ID kamu"
              required
            />
          </div>
          <div>
            <label htmlFor="claim-reason" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Alasan
            </label>
            <select
              id="claim-reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full rounded-xl border border-[#EBEBEB] bg-white px-4 py-3 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="claim-description" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Deskripsi
            </label>
            <textarea
              id="claim-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-24 w-full resize-none rounded-xl border border-[#EBEBEB] px-4 py-3 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
              placeholder="Jelaskan masalah yang kamu alami..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#2A2A2A] disabled:opacity-50"
          >
            {loading ? 'Mengirim...' : <><Send className="h-4 w-4" /> Kirim Klaim</>}
          </button>
        </form>
      </section>

      <h2 className="mb-3 text-sm font-bold text-[#141414]">Riwayat Klaim</h2>
      {claims.length === 0 ? (
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-8 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-[#D9D9D6]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#141414]">Belum ada klaim</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Klaim garansi muncul di sini begitu lu ajukan via form di atas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const { tone, label } = claimTone(claim.status)
            return (
              <div key={claim.id} className="rounded-3xl border border-[#EBEBEB] bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-sm font-bold capitalize text-[#141414]">
                    {REASONS.find((r) => r.value === claim.reason)?.label || claim.reason}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusToneClasses(tone).pill}`}
                  >
                    {label}
                  </span>
                </div>
                <p className="mb-1 text-xs text-[#3A3A3A]">{claim.description}</p>
                {claim.admin_note ? (
                  <p className="mt-2 text-xs text-[#3A3A3A]">
                    <span className="font-semibold text-[#141414]">Admin:</span> {claim.admin_note}
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] text-[#A6A6A1]">
                  {new Date(claim.created_at).toLocaleDateString('id-ID')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
