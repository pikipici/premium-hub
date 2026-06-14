"use client"

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function WaitingPaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const orderId = searchParams.get('id')
    const token = searchParams.get('token')
    if (orderId && token) {
      router.replace(`/product/digiproduct/checkout/invoice?id=${orderId}&token=${encodeURIComponent(token)}`)
    } else if (orderId) {
      router.replace(`/product/digiproduct/checkout/invoice?id=${orderId}`)
    } else {
      router.replace('/product/digiproduct')
    }
  }, [router, searchParams])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-[#888]">Mengarahkan ke checkout...</p>
    </div>
  )
}
