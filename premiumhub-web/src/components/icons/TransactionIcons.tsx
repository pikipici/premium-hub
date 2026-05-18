import type { SVGProps } from 'react'

/**
 * Shared transaction icons for dashboard wallet/activity surfaces.
 * Replaces inline duplicate definitions previously found in:
 * - src/app/dashboard/page.tsx
 * - src/app/dashboard/riwayat-order/page.tsx
 * - src/app/dashboard/notifikasi/page.tsx
 */

export function TransactionDollarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.8 13a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1" />
      <path d="M18 11v10" />
      <path d="M3 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M7 5h8" />
      <path d="M7 5v8a3 3 0 0 0 3 3h1" />
    </svg>
  )
}

export function ReceiptRefundIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
      <path d="M15 14v-2a2 2 0 0 0 -2 -2h-4l2 -2m0 4l-2 -2" />
    </svg>
  )
}
