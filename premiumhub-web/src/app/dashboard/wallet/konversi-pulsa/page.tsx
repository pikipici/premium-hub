import Link from 'next/link'

export default function WalletConvertPulsaPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Konversi Pulsa</h1>
        <p className="mt-1 text-sm text-[#888]">Halaman transaksi konversi pulsa sedang disiapkan.</p>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <div className="rounded-xl border border-dashed border-[#D9D9D6] bg-[#FAFAF8] p-4 text-sm text-[#666]">
          Form konversi (provider, nominal pulsa, nominal diterima, rekening bank, dan upload bukti)
          akan tersedia di halaman ini.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/wallet/konversi-pulsa/riwayat"
            className="inline-flex items-center justify-center rounded-lg border border-[#D9D9D6] bg-white px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
          >
            Buka Riwayat
          </Link>
        </div>
      </section>
    </div>
  )
}
