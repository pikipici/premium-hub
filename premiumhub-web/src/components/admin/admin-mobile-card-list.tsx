"use client"

import type { ReactNode } from 'react'

import { AdminSkeleton, AdminEmptyState } from '@/components/admin/admin-ui'

type Props<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  loading?: boolean
  loadingRows?: number
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

export default function AdminMobileCardList<T>({
  items,
  renderItem,
  loading = false,
  loadingRows = 5,
  emptyTitle = 'Tidak ada data',
  emptyDescription,
  className = '',
}: Props<T>) {
  if (loading) {
    return <AdminSkeleton rows={loadingRows} className={className} />
  }

  if (!items.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} className={className} />
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => (
        <div
          key={typeof item === 'object' && item !== null && 'id' in item ? (item as { id: string }).id : index}
          className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}
