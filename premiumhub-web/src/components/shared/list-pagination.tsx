'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

type Tone = 'admin' | 'customer'

interface ListPaginationProps {
  page: number
  totalPages: number
  total?: number
  itemLabel?: string
  loading?: boolean
  onPageChange: Dispatch<SetStateAction<number>> | ((page: number) => void)
  tone?: Tone
  className?: string
}

const toneStyles: Record<Tone, {
  wrapper: string
  summary: string
  strong: string
  button: string
}> = {
  admin: {
    wrapper: 'pagination-controls',
    summary: '',
    strong: '',
    button: 'action-btn',
  },
  customer: {
    wrapper: 'mt-5 flex flex-col gap-3 rounded-2xl border border-[#EBEBEB] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
    summary: 'text-xs text-[#888]',
    strong: 'font-semibold text-[#141414]',
    button: 'inline-flex items-center gap-1 rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-50',
  },
}

function callPageChange(
  onPageChange: ListPaginationProps['onPageChange'],
  nextPage: number | ((page: number) => number)
) {
  onPageChange(nextPage as never)
}

export function ListPagination({
  page,
  totalPages,
  total,
  itemLabel = 'item',
  loading = false,
  onPageChange,
  tone = 'admin',
  className = '',
}: ListPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const styles = toneStyles[tone]
  const wrapperClassName = [styles.wrapper, className].filter(Boolean).join(' ')
  const hasTotal = typeof total === 'number'
  const summary = hasTotal
    ? `Menampilkan halaman ${page} dari ${safeTotalPages} • total ${total} ${itemLabel}`
    : `Halaman ${page} dari ${safeTotalPages}`

  if (tone === 'admin') {
    return (
      <div className={wrapperClassName}>
        <button
          className={styles.button}
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => callPageChange(onPageChange, (prev: number) => Math.max(1, prev - 1))}
        >
          Sebelumnya
        </button>
        <span>
          {summary}
        </span>
        <button
          className={styles.button}
          type="button"
          disabled={page >= safeTotalPages || loading}
          onClick={() => callPageChange(onPageChange, (prev: number) => Math.min(safeTotalPages, prev + 1))}
        >
          Berikutnya
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClassName}>
      <p className={styles.summary}>
        Menampilkan halaman <span className={styles.strong}>{page}</span> dari{' '}
        <span className={styles.strong}>{safeTotalPages}</span>
        {hasTotal ? ` • total ${total} ${itemLabel}` : ''}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => callPageChange(onPageChange, (prev: number) => Math.max(1, prev - 1))}
          disabled={page <= 1 || loading}
          className={styles.button}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
        </button>

        <button
          type="button"
          onClick={() => callPageChange(onPageChange, (prev: number) => Math.min(safeTotalPages, prev + 1))}
          disabled={page >= safeTotalPages || loading}
          className={styles.button}
        >
          Selanjutnya <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
