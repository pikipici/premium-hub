"use client"

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { animate, createScope } from 'animejs'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'

import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'

export default function WalletBadge() {
  const walletBadgeRef = useRef<HTMLAnchorElement | null>(null)
  const previousBalanceRef = useRef<number | null>(null)
  const { isAuthenticated, walletBalance, setWalletBalance, hasHydrated, isBootstrapped } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped

  const { data } = useQuery({
    queryKey: ['wallet-balance-badge'],
    queryFn: async () => {
      const res = await walletService.getBalance()
      return res.data.balance
    },
    enabled: authReady && isAuthenticated,
  })

  useEffect(() => {
    if (typeof data === 'number') {
      setWalletBalance(data)
    }
  }, [data, setWalletBalance])

  // Store is source of truth so balance updates from any page (topup/order/etc.)
  // are reflected immediately without waiting for query refetch.
  const balance = walletBalance

  useEffect(() => {
    if (!walletBadgeRef.current) return

    const previousBalance = previousBalanceRef.current
    previousBalanceRef.current = balance

    if (previousBalance === null || previousBalance === balance) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const scope = { current: createScope({ root: walletBadgeRef }).add(() => {
      animate('[data-anime="wallet-balance"]', {
        scale: [1, 1.04, 1],
        backgroundColor: ['#FFF3EF', '#FFE4DA', '#FFF3EF'],
        duration: 520,
        ease: 'out(3)',
      })
    }) }

    return () => scope.current.revert()
  }, [balance])

  if (!authReady || !isAuthenticated) return null

  return (
    <Link
      ref={walletBadgeRef}
      href="/dashboard/wallet"
      data-anime="wallet-balance"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF3EF] text-[#FF5733] text-xs font-bold hover:bg-[#FFE4DA] transition-colors"
      title="Lihat wallet"
    >
      <Wallet className="w-3.5 h-3.5" />
      {formatRupiah(balance)}
    </Link>
  )
}
