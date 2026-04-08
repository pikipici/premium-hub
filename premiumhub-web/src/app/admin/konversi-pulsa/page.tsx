import { redirect } from 'next/navigation'

export default function AdminLegacyKonversiPulsaPage() {
  redirect('/admin/convert/orders?asset=pulsa')
}
