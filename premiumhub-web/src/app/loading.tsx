import { DigiLoading } from '@/components/shared/DigiLoading'
import { pageLoadingCopy } from '@/lib/loadingUi'

export default function Loading() {
  return <DigiLoading fullPage message={pageLoadingCopy.global} skeletonCount={4} />
}
