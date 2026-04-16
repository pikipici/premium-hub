import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

const sections = [
  {
    title: '1. Ketentuan Umum',
    body: 'Dengan menggunakan layanan PremiumHub, kamu menyetujui seluruh syarat yang berlaku pada halaman ini.',
  },
  {
    title: '2. Akun & Keamanan',
    body: 'Kamu bertanggung jawab atas kerahasiaan akun, termasuk email, password, dan seluruh aktivitas yang terjadi di akunmu.',
  },
  {
    title: '3. Produk & Layanan',
    body: 'Detail produk, durasi, status order, dan ketersediaan mengikuti data realtime dari sistem pada saat transaksi.',
  },
  {
    title: '4. Pembayaran',
    body: 'Setiap transaksi dianggap final setelah pembayaran terkonfirmasi. Harga dapat berubah sewaktu-waktu sesuai kebijakan platform.',
  },
  {
    title: '5. Kebijakan Refund',
    body: 'Refund hanya berlaku untuk kondisi yang memenuhi syarat operasional (misalnya order gagal karena issue sistem/provider) dan diproses sesuai audit internal.',
  },
  {
    title: '6. Larangan Penggunaan',
    body: 'Dilarang menggunakan layanan untuk aktivitas ilegal, penipuan, spam, atau tindakan yang melanggar hukum dan kebijakan platform.',
  },
  {
    title: '7. Perubahan Syarat',
    body: 'PremiumHub berhak memperbarui syarat layanan. Versi terbaru akan dipublikasikan di halaman ini.',
  },
  {
    title: '8. Kontak',
    body: 'Untuk pertanyaan terkait syarat layanan, silakan hubungi tim support melalui channel resmi PremiumHub.',
  },
]

export default function TermsPage() {
  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5] py-10 sm:py-14">
        <section className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Legal</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#141414] sm:text-3xl">Syarat & Ketentuan</h1>
            <p className="mt-2 text-sm text-[#888]">Terakhir diperbarui: 16 April 2026</p>

            <div className="mt-6 space-y-5">
              {sections.map((section) => (
                <article key={section.title} className="rounded-xl border border-[#EFEFEB] bg-[#FAFAF8] px-4 py-3.5">
                  <h2 className="text-sm font-bold text-[#141414]">{section.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#555]">{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
