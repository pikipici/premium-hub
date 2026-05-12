import { Suspense } from 'react'

import ConvertPage from '@/components/convert/ConvertPage'
import { DigiLoading } from '@/components/shared/DigiLoading'

function ConvertPageFallback() {
  return <DigiLoading message="Menyiapkan halaman convert crypto..." />
}

export default function ProductConvertCryptoPage() {
  return (
    <Suspense fallback={<ConvertPageFallback />}>
      <ConvertPage assetType="crypto" />
    </Suspense>
  )
}
