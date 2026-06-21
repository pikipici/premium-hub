'use client'

export function CheckoutSkeleton() {
  return (
    <>
      {/* Navbar skeleton */}
      <nav className="sticky top-0 z-50 border-b border-[#EBEBEB] bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-8 animate-pulse rounded-xl bg-[#EBEBEB]" />
          <div className="h-5 w-28 animate-pulse rounded bg-[#EBEBEB]" />
          <div className="ml-auto h-10 w-48 animate-pulse rounded-full bg-[#EBEBEB]" />
        </div>
      </nav>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-2xl px-4">
          {/* Breadcrumb skeleton */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-[#EBEBEB]" />
            <div className="h-4 w-4 animate-pulse rounded bg-[#EBEBEB]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[#EBEBEB]" />
          </div>

          {/* Title skeleton */}
          <div className="mb-8 h-7 w-52 animate-pulse rounded bg-[#EBEBEB]" />

          {/* Order summary skeleton */}
          <div className="mb-6 rounded-2xl border border-[#EBEBEB] bg-white p-6">
            <div className="mb-4 h-4 w-28 animate-pulse rounded bg-[#EBEBEB]" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-16 animate-pulse rounded bg-[#EBEBEB]" />
                  <div className="h-4 w-32 animate-pulse rounded bg-[#EBEBEB]" />
                </div>
              ))}
              <div className="border-t border-[#EBEBEB] pt-3">
                <div className="flex justify-between">
                  <div className="h-5 w-12 animate-pulse rounded bg-[#EBEBEB]" />
                  <div className="h-6 w-24 animate-pulse rounded bg-[#EBEBEB]" />
                </div>
              </div>
            </div>
          </div>

          {/* Form skeleton */}
          <div className="mb-6 rounded-2xl border border-[#EBEBEB] bg-white p-6">
            <div className="mb-4 h-4 w-20 animate-pulse rounded bg-[#EBEBEB]" />
            <div className="mb-4 h-11 w-full animate-pulse rounded-xl bg-[#EBEBEB]" />
            <div className="mb-4 h-11 w-full animate-pulse rounded-xl bg-[#EBEBEB]" />
            <div className="h-20 w-full animate-pulse rounded-xl bg-[#EBEBEB]" />
          </div>

          {/* Confirmation skeleton */}
          <div className="mb-6 h-48 animate-pulse rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-5" />

          {/* Payment skeleton */}
          <div className="mb-6 h-40 animate-pulse rounded-2xl border border-[#EBEBEB] bg-white p-6" />

          {/* Button skeleton */}
          <div className="h-14 w-full animate-pulse rounded-full bg-[#EBEBEB]" />
        </div>
      </section>

      {/* Footer skeleton */}
      <footer className="mt-auto bg-[#141414]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 w-20 animate-pulse rounded bg-neutral-800" />
                <div className="h-3 w-32 animate-pulse rounded bg-neutral-800" />
                <div className="h-3 w-24 animate-pulse rounded bg-neutral-800" />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </>
  )
}
