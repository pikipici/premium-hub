"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BarChart3, Box, CircleAlert, DollarSign, ListChecks } from 'lucide-react'

import { gmailAdminService } from '@/services/gmailAdminService'

interface DashboardStat {
  pending_verify: number
  verified: number
  sold: number
  rejected: number
}

const SECTIONS = [
  {
    href: '/admin/gmail/verifikasi',
    label: 'Verifikasi Setoran',
    desc: 'Antrian akun gmail dari seller. Login test, ganti password, mark verified.',
    icon: ListChecks,
  },
  {
    href: '/admin/gmail/inventory',
    label: 'Inventory',
    desc: 'Browse semua akun gmail per status: verified, sold, rejected, expired, disposed.',
    icon: Box,
  },
  {
    href: '/admin/gmail/pricing',
    label: 'Pricing',
    desc: 'Konfigurasi buy/sell price, bulk discount tier, low inventory threshold.',
    icon: DollarSign,
  },
  {
    href: '/admin/gmail/strikes',
    label: 'Strike Users',
    desc: 'User dengan strike aktif sell-side. Reset ban + clear strikes.',
    icon: CircleAlert,
  },
  {
    href: '/admin/gmail/analytics',
    label: 'Sales Analytics',
    desc: 'Inventory in/out, revenue, cost, margin per minggu (default 8 minggu).',
    icon: BarChart3,
  },
] as const

export default function AdminGmailHubPage() {
  const [stats, setStats] = useState<DashboardStat | null>(null)
  const [error, setError] = useState('')

  const fetchStats = useCallback(async () => {
    setError('')
    try {
      const res = await gmailAdminService.listInventory({ page: 1, limit: 1 })
      const counts = res.data?.counts ?? {}
      setStats({
        pending_verify: counts.pending_verify ?? 0,
        verified: counts.verified ?? 0,
        sold: counts.sold ?? 0,
        rejected: counts.rejected ?? 0,
      })
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat stats.')
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
          {error}
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Antrian Verify" value={stats.pending_verify} tone="amber" />
          <StatCard label="Stok Verified" value={stats.verified} tone="emerald" />
          <StatCard label="Total Sold" value={stats.sold} tone="sky" />
          <StatCard label="Rejected" value={stats.rejected} tone="rose" />
        </div>
      )}

      {/* Sections */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-start gap-4 rounded-3xl border border-[#EBEBEB] bg-white p-5 transition hover:bg-[#F7F7F5]"
          >
            <div className="rounded-2xl bg-[#141414] p-3 text-white">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#141414]">{s.label}</h3>
                <ArrowRight className="h-4 w-4 text-[#6B6B6B]" />
              </div>
              <p className="mt-1 text-sm text-[#6B6B6B]">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'emerald' | 'sky' | 'rose' }) {
  const tones = {
    amber: 'text-[#B45309] bg-[#FEF3C7]',
    emerald: 'text-[#0F705C] bg-[#D1FADF]',
    sky: 'text-[#0369A1] bg-[#DBEAFE]',
    rose: 'text-[#A6260F] bg-[#FFE0D6]',
  } as const
  return (
    <div className="rounded-3xl border border-[#EBEBEB] bg-white p-4">
      <div className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#141414]">{value}</div>
    </div>
  )
}
