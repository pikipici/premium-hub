import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type DivProps = ComponentPropsWithoutRef<'div'>

export function AdminSurface({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-[0_24px_80px_rgba(20,20,20,0.07)]',
        className
      )}
      {...props}
    />
  )
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-neutral-900 bg-[#141414] p-5 text-white shadow-[0_20px_70px_rgba(20,20,20,0.18)] md:p-6',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-[#ff5733]/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-1/2 -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/65">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-2xl font-black tracking-[-0.04em] text-white md:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/62 md:text-[15px]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export function AdminStatCard({
  label,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  detail?: string
  tone?: 'neutral' | 'orange' | 'green' | 'red'
  className?: string
}) {
  const toneClass = {
    neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
    orange: 'bg-[#fff1eb] text-[#c2410c] ring-[#fed7aa]',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    red: 'bg-rose-50 text-rose-700 ring-rose-100',
  }[tone]

  return (
    <AdminSurface className={cn('p-4 shadow-[0_12px_40px_rgba(20,20,20,0.05)]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-neutral-400">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-neutral-950">{value}</div>
        </div>
        <div className={cn('size-2.5 rounded-full ring-4', toneClass)} />
      </div>
      {detail ? <div className="mt-2 text-xs font-semibold leading-5 text-neutral-500">{detail}</div> : null}
    </AdminSurface>
  )
}

export function AdminFilterBar({ className, ...props }: DivProps) {
  return <AdminSurface className={cn('p-3 shadow-none', className)} {...props} />
}

export function AdminEmptyState({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 p-8 text-center', className)}>
      <div className="text-sm font-black text-neutral-950">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-sm text-xs font-semibold leading-5 text-neutral-500">{description}</p> : null}
    </div>
  )
}

export function AdminStatusPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'orange'
  className?: string
}) {
  const toneClass = {
    neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-none',
        toneClass,
        className
      )}
    >
      {children}
    </span>
  )
}
