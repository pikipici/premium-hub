"use client"

import { formatRupiah } from '@/lib/utils'
import { ArrowUpRight, Wallet } from 'lucide-react'

interface WalletCardProps {
  balance: number
  totalTopup?: number
  totalSpent?: number
  loading?: boolean
  onTopUp?: () => void
}

export default function WalletCard({
  balance,
  totalTopup,
  totalSpent,
  loading,
  onTopUp,
}: WalletCardProps) {
  return (
    <section className="bg-white rounded-3xl border border-[#EBEBEB] shadow-[0_16px_38px_rgba(20,20,20,0.06)] p-5 md:p-6 mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B7280] mb-2">
            <Wallet className="w-4 h-4" /> Wallet
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#141414]">
            {loading ? 'Memuat saldo...' : formatRupiah(balance)}
          </div>
          <p className="text-xs text-[#6B7280] mt-1">Saldo aktif untuk checkout instan</p>
        </div>

        <button
          type="button"
          onClick={onTopUp}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#141414] text-white text-sm font-extrabold hover:bg-[#2A2A2A] transition-colors"
        >
          Top Up
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-2xl bg-[#F7F7F5] p-3">
          <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Total Topup</div>
          <div className="text-sm font-bold text-[#141414]">{formatRupiah(totalTopup ?? 0)}</div>
        </div>
        <div className="rounded-2xl bg-[#F7F7F5] p-3">
          <div className="text-[11px] font-semibold text-[#6B7280] mb-1">Total Dipakai</div>
          <div className="text-sm font-bold text-[#141414]">{formatRupiah(totalSpent ?? 0)}</div>
        </div>
      </div>
    </section>
  )
}
