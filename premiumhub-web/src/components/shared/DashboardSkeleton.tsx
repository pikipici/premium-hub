"use client"

/**
 * Dashboard skeleton variants — preserve sidebar+header context, only the
 * data panel shows shimmer. Replaces the full-page `Loader2 animate-spin`
 * pattern used across dashboard routes.
 *
 * Usage:
 *   {loading ? <DashboardSkeleton variant="list" /> : <DataPanel />}
 */

type SkeletonVariant = 'stat-grid' | 'list' | 'form' | 'detail' | 'card-grid'

interface DashboardSkeletonProps {
  variant?: SkeletonVariant
  rows?: number
}

export function DashboardSkeleton({ variant = 'list', rows = 4 }: DashboardSkeletonProps) {
  if (variant === 'stat-grid') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-[#F4F4F2]" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-[#F4F4F2]" />
            </div>
            <div className="h-7 w-16 animate-pulse rounded-md bg-[#F4F4F2]" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'card-grid') {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
            <div className="mb-3 h-4 w-3/4 animate-pulse rounded-full bg-[#F4F4F2]" />
            <div className="mb-2 h-3 w-1/2 animate-pulse rounded-full bg-[#F4F4F2]" />
            <div className="mt-4 h-9 animate-pulse rounded-full bg-[#F4F4F2]" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <div className="mb-4 h-4 w-32 animate-pulse rounded-full bg-[#F4F4F2]" />
        <div className="space-y-4">
          {[...Array(rows)].map((_, i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-20 animate-pulse rounded-full bg-[#F4F4F2]" />
              <div className="h-11 animate-pulse rounded-xl bg-[#F4F4F2]" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
          <div className="mb-3 h-5 w-1/2 animate-pulse rounded-full bg-[#F4F4F2]" />
          <div className="mb-2 h-3 w-3/4 animate-pulse rounded-full bg-[#F4F4F2]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[#F4F4F2]" />
        </div>
        <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
          <div className="space-y-3">
            {[...Array(rows)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-24 animate-pulse rounded-full bg-[#F4F4F2]" />
                <div className="h-3 w-32 animate-pulse rounded-full bg-[#F4F4F2]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 'list' variant (default)
  return (
    <div className="rounded-3xl border border-[#EBEBEB] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[#F4F4F2]" />
        <div className="h-3 w-16 animate-pulse rounded-full bg-[#F4F4F2]" />
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-[#F7F7F5] p-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[#EBEBEB]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-[#EBEBEB]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-[#EBEBEB]" />
            </div>
            <div className="h-3 w-16 animate-pulse rounded-full bg-[#EBEBEB]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardSkeleton
