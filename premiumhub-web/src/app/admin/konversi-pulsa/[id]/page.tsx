import { redirect } from 'next/navigation'

type AdminLegacyKonversiPulsaDetailProps = {
  params: Promise<{ id: string }>
}

export default async function AdminLegacyKonversiPulsaDetailPage({ params }: AdminLegacyKonversiPulsaDetailProps) {
  const { id } = await params
  redirect(`/admin/convert/orders?asset=pulsa&focus=${encodeURIComponent(id)}`)
}
