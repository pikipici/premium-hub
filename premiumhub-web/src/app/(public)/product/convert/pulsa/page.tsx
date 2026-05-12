import { Suspense } from 'react'

import ConvertPage from '@/components/convert/ConvertPage'
import { DigiLoading } from '@/components/shared/DigiLoading'

function ConvertPageFallback() {
  return <DigiLoading message="Menyiapkan halaman convert pulsa..." />
}

export default function ProductConvertPulsaPage() {
  return (
    <Suspense fallback={<ConvertPageFallback />}>
      <ConvertPage assetType="pulsa" />
    </Suspense>
  )
}
