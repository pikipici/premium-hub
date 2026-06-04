"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { orderService } from '@/services/orderService'
import { useState } from 'react'
import { Search, Mail, Loader2, CheckCircle2 } from 'lucide-react'

export default function LacakPesananPage() {
  const [orderID, setOrderID] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = orderID.trim()
    const em = email.trim().toLowerCase()

    if (!id) {
      setError('Masukkan Order ID dari invoice kamu.')
      return
    }
    if (!em || !em.includes('@')) {
      setError('Masukkan email yang valid.')
      return
    }

    setLoading(true)
    setError('')
    setDone(false)

    try {
      await orderService.resendGuestInvoice({ order_id: id, email: em })
      setDone(true)
    } catch {
      // Backend selalu return 200 untuk mencegah enumeration
      // "Jika data cocok, link invoice sudah dikirim"
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />

      <section className="py-12 md:py-16">
        <div className="max-w-lg mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#F7F7F5] border border-[#EBEBEB] mb-4">
              <Search className="h-6 w-6 text-[#FF5733]" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Lacak Pesanan</h1>
            <p className="mt-2 text-sm text-[#888] max-w-sm mx-auto">
              Masukkan Order ID dan email yang dipakai saat checkout. Link invoice akan dikirim ulang ke email kamu.
            </p>
          </div>

          {done ? (
            <div className="rounded-2xl border border-[#D1F0D9] bg-[#EDFBF2] p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-[#16A34A] mx-auto mb-3" />
              <h2 className="text-base font-bold text-[#166534] mb-1">Link Invoice Dikirim!</h2>
              <p className="text-sm text-[#4B7B5E]">
                Cek inbox email <strong>{email}</strong>. Kalau nggak muncul, cek folder spam atau coba lagi.
              </p>
              <button
                type="button"
                onClick={() => { setDone(false); setOrderID(''); setEmail(''); }}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-5 py-2 text-sm font-semibold text-[#166534] hover:bg-[#F0FDF4]"
              >
                Cari pesanan lain
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-[#EBEBEB] bg-white p-6 space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#555] mb-1">
                  <Search className="h-3.5 w-3.5" />
                  Order ID
                </label>
                <input
                  type="text"
                  value={orderID}
                  onChange={(e) => setOrderID(e.target.value)}
                  placeholder="d8a1b2c3-e456-..."
                  className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733] font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#555] mb-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email saat checkout
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm outline-none focus:border-[#FF5733]"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 text-xs font-semibold text-[#B91C1C]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#141414] px-6 py-3 text-sm font-bold text-white hover:bg-[#2A2A2A] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim...</>
                ) : (
                  'Kirim Link Invoice'
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
