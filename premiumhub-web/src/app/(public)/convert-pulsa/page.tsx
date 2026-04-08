import { redirect } from 'next/navigation'

export default function LegacyConvertPulsaPage() {
  redirect('/convert?type=pulsa')
}
