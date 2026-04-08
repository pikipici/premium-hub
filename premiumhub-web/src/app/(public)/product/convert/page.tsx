import Link from 'next/link'
import { ArrowRight, Bitcoin, Smartphone, Wallet } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

const SERVICES = [
  {
    href: '/product/convert/pulsa',
    title: 'Convert Pulsa',
    icon: Smartphone,
    desc: 'Ubah saldo pulsa jadi transfer bank dengan estimasi proses cepat.',
    badge: 'Guest / Member',
    tone: 'from-[#FFF3EF] to-[#FFE7DE]',
  },
  {
    href: '/product/convert/paypal',
    title: 'Convert PayPal',
    icon: Wallet,
    desc: 'Tarik saldo PayPal ke rekening lokal dengan validasi yang aman.',
    badge: 'Login wajib',
    tone: 'from-[#EFF6FF] to-[#E1EEFF]',
  },
  {
    href: '/product/convert/crypto',
    title: 'Convert Crypto',
    icon: Bitcoin,
    desc: 'Jual aset crypto ke rupiah dengan pilihan network yang fleksibel.',
    badge: 'Login wajib',
    tone: 'from-[#FFFBEA] to-[#FFF3C9]',
  },
] as const

export default function ProductConvertLandingPage() {
  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#141414] md:text-4xl">Convert Aset</h1>
            <p className="mt-2 text-sm text-[#888]">Pilih layanan convert sesuai aset yang mau lu proses.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            {SERVICES.map((service) => (
              <Link
                key={service.href}
                href={service.href}
                className="group rounded-2xl border border-[#EBEBEB] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${service.tone}`}>
                  <service.icon className="h-5 w-5 text-[#141414]" />
                </div>

                <h2 className="text-lg font-extrabold text-[#141414]">{service.title}</h2>
                <p className="mt-1 text-xs font-semibold text-[#FF5733]">{service.badge}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#666]">{service.desc}</p>

                <div className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[#141414]">
                  Mulai Convert <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
