"use client"

import Link from 'next/link'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'

import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'

export default function WalletBadge() {
  const { isAuthenticated, walletBalance, setWalletBalance, hasHydrated } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['wallet-balance-badge'],
    queryFn: async () => {
      const res = await walletService.getBalance()
      return res.data.balance
    },
    enabled: hasHydrated && isAuthenticated,
  })

  useEffect(() => {
    if (typeof data === 'number') {
      setWalletBalance(data)
    }
  }, [data, setWalletBalance])

  if (!hasHydrated || !isAuthenticated) return null

  const balance = typeof data === 'number' ? data : walletBalance

  return (
    <Link
      href="/dashboard/wallet"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF3EF] text-[#FF5733] text-xs font-bold hover:bg-[#FFE4DA] transition-colors"
      title="Lihat wallet"
    >
      <Wallet className="w-3.5 h-3.5" />
      {formatRupiah(balance)}
    </Link>
  )
}
