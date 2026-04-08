"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { orderService } from '@/services/orderService'
import type { Order } from '@/types/order'
import { CheckCircle, Copy, Check } from 'lucide-react'

export default function OrderSuksesPage() {
  return (
    <Suspense fallback={<><Navbar /><div className="py-32 text-center"><div className="animate-pulse text-[#888]">Loading...</div></div><Footer /></>}>
      <OrderSuksesContent />
    </Suspense>
  )
}

function OrderSuksesContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('id')
  const [order, setOrder] = useState<Order | null>(null)
  const [copied, setCopied] = useState<string>('')

  useEffect(() => {
    if (orderId) {
      orderService.getByID(orderId).then(res => {
        if (res.success) setOrder(res.data)
      }).catch(() => {})
    }
  }, [orderId])

  const copyToClip = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <>
      <Navbar />
      <section className="py-16 md:py-24">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Pembayaran Berhasil! 🎉</h1>
          <p className="text-sm text-[#888] mb-8">Akun premium kamu sudah aktif</p>

          {order?.stock && (
            <div className="bg-white rounded-2xl border border-[#EBEBEB] p-6 text-left mb-6">
              <h3 className="text-sm font-bold mb-4">Kredensial Akun</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-[#F7F7F5] rounded-xl p-3">
                  <div>
                    <span className="text-xs text-[#888] block">Email</span>
                    <span className="text-sm font-semibold">{order.stock.email}</span>
                  </div>
                  <button onClick={() => copyToClip(order.stock!.email, 'email')} className="p-2 hover:bg-white rounded-lg transition-colors">
                    {copied === 'email' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-[#888]" />}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-[#F7F7F5] rounded-xl p-3">
                  <div>
                    <span className="text-xs text-[#888] block">Password</span>
                    <span className="text-sm font-semibold">{order.stock.password}</span>
                  </div>
                  <button onClick={() => copyToClip(order.stock!.password, 'pw')} className="p-2 hover:bg-white rounded-lg transition-colors">
                    {copied === 'pw' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-[#888]" />}
                  </button>
                </div>
                {order.stock.profile_name && (
                  <div className="bg-[#F7F7F5] rounded-xl p-3">
                    <span className="text-xs text-[#888] block">Profil</span>
                    <span className="text-sm font-semibold">{order.stock.profile_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1 py-3 bg-[#141414] text-white font-bold rounded-full text-sm text-center hover:bg-[#2a2a2a] transition-colors">
              Dashboard
            </Link>
            <Link href="/product/prem-apps" className="flex-1 py-3 border-2 border-[#141414] text-[#141414] font-bold rounded-full text-sm text-center hover:bg-[#141414] hover:text-white transition-all">
              Belanja Lagi
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}
