import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DivProps = ComponentPropsWithoutRef<'div'>

export function AdminSurface({ className, ...props }: DivProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-[28px] border-neutral-200/80 bg-white/90 py-0 shadow-[0_22px_70px_rgba(17,17,24,0.08)] backdrop-blur-xl',
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
    <Card
      className={cn(
        'relative overflow-hidden rounded-[32px] border-neutral-900 bg-[#111118] py-0 text-white shadow-[0_28px_90px_rgba(17,17,24,0.22)]',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[#ff5733]/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 size-48 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <CardContent className="relative z-10 flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <Badge variant="outline" className="mb-3 border-white/10 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/65">
              {eyebrow}
            </Badge>
          ) : null}
          <CardTitle className="text-2xl font-black tracking-[-0.05em] text-white md:text-4xl">{title}</CardTitle>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62 md:text-[15px]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
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
    <AdminSurface className={cn('p-4 shadow-[0_16px_48px_rgba(17,17,24,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#ff5733]/30 hover:shadow-[0_24px_70px_rgba(17,17,24,0.1)]', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-0">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-400">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-neutral-950">{value}</div>
        </div>
        <div className={cn('size-2.5 rounded-full ring-4', toneClass)} />
      </CardHeader>
      {detail ? <div className="mt-2 text-xs font-semibold leading-5 text-neutral-500">{detail}</div> : null}
    </AdminSurface>
  )
}

export function AdminFilterBar({ className, ...props }: DivProps) {
  return <AdminSurface className={cn('p-3 shadow-[0_14px_40px_rgba(17,17,24,0.05)]', className)} {...props} />
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
    <div className={cn('rounded-[24px] border border-dashed border-neutral-200 bg-white/70 p-8 text-center shadow-inner', className)}>
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
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold leading-none',
        toneClass,
        className
      )}
    >
      {children}
    </Badge>
  )
}
