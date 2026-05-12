import { buildLoadingMessage, loadingSkeletonItems } from '@/lib/loadingUi'

type DigiLoadingProps = {
  message?: string
  fullPage?: boolean
  skeletonCount?: number
}

export function DigiLoading({ message, fullPage = false, skeletonCount = 0 }: DigiLoadingProps) {
  const content = (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-[#FFE2CF]" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#FF5733] border-r-[#FF9B31] animate-spin" />
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#141414] text-sm font-black text-white shadow-[0_12px_24px_rgba(20,20,20,0.16)]">
          D
        </div>
      </div>
      <p className="mt-4 text-sm font-extrabold text-[#141414]">{buildLoadingMessage(message)}</p>
      <p className="mt-1 text-xs font-medium text-[#77716C]">Tunggu bentar ya, data lagi disiapin.</p>
      {skeletonCount > 0 ? (
        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          {loadingSkeletonItems(skeletonCount).map((item) => (
            <div key={item} className="h-20 rounded-2xl border border-[#FFE2CF]/70 bg-white/70 shadow-sm animate-pulse" />
          ))}
        </div>
      ) : null}
    </div>
  )

  if (fullPage) {
    return <div className="flex min-h-[65vh] items-center justify-center bg-[#F7F7F5]">{content}</div>
  }

  return <div className="flex items-center justify-center py-16">{content}</div>
}

export function DigiLoadingCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
      {loadingSkeletonItems(count).map((item) => (
        <article key={item} className="overflow-hidden rounded-3xl border border-[#FFE2CF]/70 bg-white shadow-sm">
          <div className="h-24 bg-gradient-to-br from-[#FFF3EF] to-white animate-pulse sm:h-28" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-3/4 rounded-full bg-[#FFE2CF] animate-pulse" />
            <div className="h-3 w-1/2 rounded-full bg-[#F1ECE8] animate-pulse" />
            <div className="h-8 rounded-xl bg-[#FFF3EF] animate-pulse" />
          </div>
        </article>
      ))}
    </div>
  )
}
