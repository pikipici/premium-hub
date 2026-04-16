import Link from 'next/link'
import { ArrowRight, BarChart3, Heart, MessageCircle, PlayCircle, Share2, Users } from 'lucide-react'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

const SERVICES = [
  {
    key: 'followers',
    title: 'Followers Growth',
    icon: Users,
    desc: 'Tambah followers tertarget buat ningkatin trust akun brand atau personal.',
    badge: 'Instagram • TikTok • X',
    tone: 'from-[#EEF8FF] to-[#DCEFFF]',
  },
  {
    key: 'likes',
    title: 'Likes & Favorite',
    icon: Heart,
    desc: 'Boost engagement post biar social proof konten lu langsung kebaca.',
    badge: 'Realtime Delivery',
    tone: 'from-[#FFF1F3] to-[#FFE1E7]',
  },
  {
    key: 'views',
    title: 'Views / Watchtime',
    icon: PlayCircle,
    desc: 'Dorong performa konten video dengan paket view yang stabil.',
    badge: 'Reels • Shorts • TikTok',
    tone: 'from-[#FFFBEA] to-[#FFF3C9]',
  },
  {
    key: 'comments',
    title: 'Komentar Aktif',
    icon: MessageCircle,
    desc: 'Aktifkan social signal lewat komentar agar post terlihat lebih hidup.',
    badge: 'Custom / Random',
    tone: 'from-[#F4F0FF] to-[#E8DEFF]',
  },
  {
    key: 'shares',
    title: 'Share & Save',
    icon: Share2,
    desc: 'Tambahin sinyal distribusi konten supaya jangkauan organik makin kebuka.',
    badge: 'Boost Discovery',
    tone: 'from-[#ECFFFA] to-[#D6FFF2]',
  },
  {
    key: 'analytics',
    title: 'Campaign Scale Pack',
    icon: BarChart3,
    desc: 'Paket bundling multi-metrik untuk campaign launching atau seasonal push.',
    badge: 'Best for Brand',
    tone: 'from-[#FFF4EC] to-[#FFE8D8]',
  },
] as const

export default function ProductSosmedLandingPage() {
  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#141414] md:text-4xl">Sosmed SMM</h1>
            <p className="mt-2 text-sm text-[#888]">
              Solusi kebutuhan Social Media Marketing buat scale akun, engagement, dan distribusi konten.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SERVICES.map((service) => (
              <article
                key={service.key}
                className="rounded-2xl border border-[#EBEBEB] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${service.tone}`}>
                  <service.icon className="h-5 w-5 text-[#141414]" />
                </div>

                <h2 className="text-lg font-extrabold text-[#141414]">{service.title}</h2>
                <p className="mt-1 text-xs font-semibold text-[#FF5733]">{service.badge}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#666]">{service.desc}</p>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-[#FFD5C8] bg-[#FFF3EF] p-6 text-center">
            <h2 className="text-xl font-extrabold text-[#141414]">Ready jualan kebutuhan SMM</h2>
            <p className="mt-2 text-sm text-[#666]">
              Masuk atau bikin akun dulu, nanti katalog Sosmed bisa langsung lu pakai untuk kebutuhan campaign client.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register?next=%2Fproduct%2Fsosmed"
                className="inline-flex items-center gap-1 rounded-full bg-[#FF5733] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e64d2e]"
              >
                Bikin Akun <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login?next=%2Fproduct%2Fsosmed"
                className="inline-flex items-center gap-1 rounded-full border border-[#141414] px-5 py-2.5 text-sm font-semibold text-[#141414] transition hover:bg-[#141414] hover:text-white"
              >
                Masuk
              </Link>
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </>
  )
}
