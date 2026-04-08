import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main className="bg-white">
        <section className="mx-auto flex min-h-[60vh] w-full max-w-7xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 md:px-8 lg:px-10">
          <div className="mb-4 inline-flex rounded-full border border-[#FF573326] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
            🏠 Home
          </div>

          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[#141414] sm:text-5xl">
            Halaman Home Sementara
          </h1>

          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[#888] sm:text-base">
            Landing utama lagi dipindahin. Untuk akses halaman nokos, langsung lanjut lewat tombol di bawah.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/nokos"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF5733] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,87,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#D94420]"
            >
              Masuk ke Nokos <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/katalog"
              className="inline-flex items-center justify-center rounded-full border border-[#EBEBEB] px-7 py-3.5 text-sm font-semibold text-[#141414] transition hover:border-[#141414] hover:bg-[#F7F7F5]"
            >
              Lihat Katalog
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
