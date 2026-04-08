"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function WalletConvertPulsaDetailPage() {
  const params = useParams()
  const trxId = typeof params.trxId === 'string' ? params.trxId : '-'

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Detail Konversi Pulsa</h1>
        <p className="mt-1 text-sm text-[#888]">Route detail transaksi siap.</p>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6 space-y-3">
        <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">Transaction ID</p>
          <p className="mt-1 text-sm font-bold text-[#141414] break-all">{trxId}</p>
        </div>

        <div className="rounded-xl border border-dashed border-[#D9D9D6] bg-[#FAFAF8] p-4 text-sm text-[#666]">
          Timeline status, detail nominal, data rekening tujuan, dan bukti transfer akan ditampilkan di sini.
        </div>

        <Link
          href="/dashboard/wallet/konversi-pulsa/riwayat"
          className="inline-flex items-center justify-center rounded-lg border border-[#D9D9D6] bg-white px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
        >
          Kembali ke Riwayat
        </Link>
      </section>
    </div>
  )
}
