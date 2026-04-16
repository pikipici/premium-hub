import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

const sections = [
  {
    title: '1. Data yang Dikumpulkan',
    body: 'DigiMarket dapat mengumpulkan data akun (nama, email), data transaksi, dan data teknis dasar (misalnya device/session) untuk operasional layanan.',
  },
  {
    title: '2. Tujuan Penggunaan Data',
    body: 'Data digunakan untuk memproses order, verifikasi pembayaran, dukungan pelanggan, peningkatan keamanan, dan peningkatan kualitas layanan.',
  },
  {
    title: '3. Penyimpanan & Keamanan',
    body: 'Kami menerapkan kontrol keamanan teknis dan operasional yang wajar untuk melindungi data dari akses tidak sah, perubahan, maupun kehilangan.',
  },
  {
    title: '4. Berbagi Data',
    body: 'Data tidak dijual ke pihak ketiga. Data hanya dibagikan bila diperlukan untuk pemrosesan layanan, kepatuhan hukum, atau instruksi resmi dari pengguna.',
  },
  {
    title: '5. Retensi Data',
    body: 'Data disimpan selama dibutuhkan untuk operasional, audit, kepatuhan hukum, atau penyelesaian sengketa yang relevan.',
  },
  {
    title: '6. Hak Pengguna',
    body: 'Kamu dapat meminta akses, koreksi, atau pembaruan data akun sesuai kebijakan internal dan ketentuan hukum yang berlaku.',
  },
  {
    title: '7. Perubahan Kebijakan',
    body: 'Kebijakan privasi dapat diperbarui sewaktu-waktu. Versi terbaru akan selalu tersedia di halaman ini.',
  },
  {
    title: '8. Kontak Privasi',
    body: 'Jika ada pertanyaan terkait privasi data, hubungi support DigiMarket melalui channel resmi.',
  },
]

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5] py-10 sm:py-14">
        <section className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Legal</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#141414] sm:text-3xl">Kebijakan Privasi</h1>
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
