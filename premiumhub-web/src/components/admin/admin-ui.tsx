'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
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

// ─── AdminDialog ────────────────────────────────────────────

export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle className="text-lg font-black tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription className="text-xs font-medium">{description}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="max-h-[60vh] overflow-y-auto pr-1">{children}</div> : null}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}

// ─── AdminTabs ──────────────────────────────────────────────

export function AdminTabs({
  defaultValue,
  tabs,
  children,
  className,
}: {
  defaultValue: string
  tabs: { value: string; label: string; icon?: ReactNode }[]
  children: ReactNode
  className?: string
}) {
  return (
    <Tabs defaultValue={defaultValue} className={cn('', className)}>
      <TabsList variant="default" className="w-full flex-wrap justify-start rounded-xl bg-neutral-100/80 p-1">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg data-active:bg-white data-active:text-[#111118] data-active:font-extrabold data-active:shadow-sm">
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}

// ─── AdminDataTable ─────────────────────────────────────────

export function AdminDataTable({
  columns,
  children,
  className,
}: {
  columns: string[]
  children: ReactNode
  className?: string
}) {
  return (
    <AdminSurface className={cn('', className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-neutral-100">
            {columns.map((col) => (
              <TableHead key={col} className="h-9 text-[11px] font-extrabold uppercase tracking-[0.12em] text-neutral-400">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </AdminSurface>
  )
}

// ─── AdminFormField ─────────────────────────────────────────

export function AdminFormField({
  label,
  htmlFor,
  required,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-neutral-500">
        {label}
        {required ? <span className="ml-0.5 text-[#ff5733]">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[10px] font-medium leading-relaxed text-neutral-400">{hint}</p> : null}
    </div>
  )
}

// ─── AdminActionMenu ────────────────────────────────────────

export function AdminActionMenu({
  label,
  items,
}: {
  label: ReactNode
  items: { label: string; icon?: ReactNode; onClick: () => void; destructive?: boolean; disabled?: boolean }[]
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="size-8 rounded-lg">
            {label}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        {items.map((item, i) => (
          <DropdownMenuItem
            key={i}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              'cursor-pointer text-xs font-semibold',
              item.destructive && 'text-rose-600 focus:bg-rose-50 focus:text-rose-700'
            )}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── AdminSkeleton ──────────────────────────────────────────

export function AdminSkeleton({
  rows = 5,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <AdminSurface className={cn('space-y-3 p-5', className)}>
      <div className="flex gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </AdminSurface>
  )
}

// ─── Re-exports for convenience ─────────────────────────────

export { Button, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, Skeleton, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Tabs, TabsList, TabsTrigger, TabsContent, Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption }
