import Link from 'next/link'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

export default function ConvertPulsaLandingPage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#EBEBEB] bg-[#F7F7F5] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#FF5733]">Route siap</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#141414] md:text-3xl">
              Konversi Pulsa ke Saldo Bank
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#666]">
              Halaman awareness fitur konversi pulsa. Komponen UI marketing (rate, fee, SLA, dan trust signal)
              bisa dilanjutkan pada iterasi berikutnya.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/wallet/konversi-pulsa"
                className="inline-flex items-center justify-center rounded-xl bg-[#FF5733] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e64d2e]"
              >
                Mulai Konversi
              </Link>
              <Link
                href="/dashboard/wallet/konversi-pulsa/riwayat"
                className="inline-flex items-center justify-center rounded-xl border border-[#D9D9D6] bg-white px-4 py-2.5 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
              >
                Cek Riwayat
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
