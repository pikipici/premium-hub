"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PlusCircle,
  RefreshCcw,
} from 'lucide-react'

import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { gmailSlotTone, statusToneClasses } from '@/lib/dashboardStatusPill'
import { formatDate } from '@/lib/utils'
import { gmailService } from '@/services/gmailService'
import type { GmailSlot } from '@/types/gmail'

export default function GmailSellHubPage() {
  const router = useRouter()
  const [slots, setSlots] = useState<GmailSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    if (silent) setRefreshing(true)
    setError('')
    try {
      const res = await gmailService.listMySlots({ page: 1, limit: 50 })
      const data = res.data as any
      setSlots(data?.items ?? data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat slot.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const pendingCount = useMemo(
    () =>
      slots.filter(
        (s) => s.status === 'pending_create' || s.status === 'pending_verify',
      ).length,
    [slots],
  )

  const requestSlot = async () => {
    setRequesting(true)
    setError('')
    try {
      const res = await gmailService.requestSlot()
      const data = res.data as any
      const slotID = data?.slot?.id ?? data?.id
      if (!slotID) throw new Error('Slot ID tidak ditemukan di respons')
      // Stash one-time creds for slot detail page to render. Backend
      // does not return password on subsequent fetches.
      const email = data?.email ?? data?.slot?.email
      const password = data?.password ?? data?.slot?.password
      if (email && password) {
        try {
          sessionStorage.setItem(
            `gmail-slot-creds:${slotID}`,
            JSON.stringify({ email, password }),
          )
        } catch {
          // ignore storage failures (private mode etc)
        }
      }
      router.push(`/dashboard/gmail/sell/slots/${slotID}?fresh=1`)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal request slot.')
      setRequesting(false)
    }
  }

  const blockedRequest = pendingCount >= 3

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/gmail"
            className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5]"
          >
            <ArrowLeft className="h-4 w-4" />
            Gmail
          </Link>
          <h1 className="text-xl font-semibold text-[#141414]">Setor Gmail</h1>
        </div>
        <button
          type="button"
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm text-[#141414] hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#141414]">Request Slot Setor</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Slot pending bersamaan: {pendingCount} / 3. Tiap slot punya waktu 6 jam buat lu bikin akun.
            </p>
          </div>
          <button
            type="button"
            onClick={requestSlot}
            disabled={blockedRequest || requesting}
            className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {requesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses…
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Request Slot Baru
              </>
            )}
          </button>
        </div>
        {blockedRequest && (
          <div className="mt-3 rounded-2xl border border-[#FFE0D6] bg-[#FFF8F4] px-4 py-3 text-xs text-[#A6260F]">
            Selesain dulu salah satu slot pending sebelum request slot baru.
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]">
          {error}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#141414]">Slot Saya</h2>
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {LOADING_COPY.list}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            title="Belum ada slot"
            hint="Request slot pertama lu buat mulai setor gmail."
          />
        ) : (
          <div className="space-y-3">
            {slots.map((s) => {
              const t = gmailSlotTone(s.status)
              const classes = statusToneClasses(t.tone)
              const cta =
                s.status === 'pending_create'
                  ? 'Lanjutkan'
                  : s.status === 'pending_verify'
                  ? 'Detail'
                  : 'Lihat'
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/gmail/sell/slots/${s.id}`}
                  className="flex flex-col gap-2 rounded-3xl border border-[#EBEBEB] bg-white p-4 hover:bg-[#F7F7F5] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${classes.pill}`}>
                        {t.label}
                      </span>
                      <span className="font-mono text-xs text-[#141414]">{s.email}</span>
                    </div>
                    <div className="text-xs text-[#6B6B6B]">
                      {formatDate(s.created_at)}
                      {s.slot_expires_at ? ` · expired ${formatDate(s.slot_expires_at)}` : ''}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-[#141414]">
                    {cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
