"use client"

import { AlertCircle, CheckCircle2, CircleDot, Clock3 } from 'lucide-react'

import {
  buildConvertTimelineSteps,
  getConvertStatusSummary,
  getEventHeadline,
  getLastUpdatedAt,
  getLatestEventReason,
  type ConvertStepState,
} from '@/lib/convertTimeline'
import type { ConvertOrderDetail } from '@/types/convert'

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function stepStateClassName(state: ConvertStepState): string {
  if (state === 'done') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (state === 'current') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (state === 'failed') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-[#EBEBEB] bg-[#FAFAF8] text-[#777]'
}

function renderStepIcon(state: ConvertStepState) {
  if (state === 'done') return <CheckCircle2 className="h-4 w-4" />
  if (state === 'current') return <Clock3 className="h-4 w-4" />
  if (state === 'failed') return <AlertCircle className="h-4 w-4" />
  return <CircleDot className="h-4 w-4" />
}

interface ConvertTimelineSectionProps {
  detail: ConvertOrderDetail
  title?: string
}

export default function ConvertTimelineSection({ detail, title = 'Timeline Status' }: ConvertTimelineSectionProps) {
  const statusSummary = getConvertStatusSummary(detail.order.status)
  const lastUpdatedAt = getLastUpdatedAt(detail)
  const latestReason = getLatestEventReason(detail.events, detail.order.status)
  const steps = buildConvertTimelineSteps(detail.order.status, detail.events)

  return (
    <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#141414]">{title}</h3>
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusSummary.badgeClassName}`}>
          {statusSummary.label}
        </span>
      </div>

      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3">
        <p className="text-sm font-bold text-[#141414]">{statusSummary.headline}</p>
        <p className="mt-1 text-xs text-[#666]">{statusSummary.description}</p>

        <div className="mt-3 grid gap-2 text-[11px] text-[#666] sm:grid-cols-3">
          <div>
            <p className="font-semibold text-[#141414]">Update terakhir</p>
            <p>{formatDate(lastUpdatedAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-[#141414]">Estimasi</p>
            <p>{statusSummary.etaHint}</p>
          </div>
          <div>
            <p className="font-semibold text-[#141414]">Next action</p>
            <p>{statusSummary.nextActionHint}</p>
          </div>
        </div>

        {latestReason ? (
          <div className="mt-3 rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-xs text-[#555]">
            <span className="font-semibold text-[#141414]">Catatan terbaru:</span> {latestReason}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <div key={step.key} className={`rounded-xl border px-3 py-2.5 ${stepStateClassName(step.state)}`}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex">{renderStepIcon(step.state)}</span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs opacity-90">{step.helperText}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#888]">Log update detail</h4>
        {detail.events.length === 0 ? (
          <p className="mt-2 text-sm text-[#888]">Belum ada event status.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {detail.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[#141414]">{getEventHeadline(event)}</p>
                  <p className="text-xs text-[#888]">{formatDate(event.created_at)}</p>
                </div>
                {event.reason ? <p className="mt-1 text-xs text-[#666]">Reason: {event.reason}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
