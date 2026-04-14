"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { maintenanceService } from '@/services/maintenanceService'
import type { MaintenanceEvaluation } from '@/types/maintenance'

const BYPASS_PREFIXES = ['/admin', '/_next', '/api']
const BYPASS_EXACT = ['/favicon.ico', '/robots.txt', '/sitemap.xml']

function shouldBypassMaintenance(pathname: string) {
  if (!pathname) return true

  if (BYPASS_EXACT.includes(pathname)) {
    return true
  }

  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function defaultMaintenanceState(): MaintenanceEvaluation {
  return { active: false }
}

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const [evaluation, setEvaluation] = useState<MaintenanceEvaluation>(defaultMaintenanceState)
  const [checking, setChecking] = useState(false)
  const requestSeq = useRef(0)

  const bypass = useMemo(() => shouldBypassMaintenance(pathname), [pathname])

  useEffect(() => {
    if (bypass) {
      setChecking(false)
      setEvaluation(defaultMaintenanceState())
      return
    }

    const seq = ++requestSeq.current
    setChecking(true)

    const run = async () => {
      try {
        const res = await maintenanceService.evaluate(pathname)
        if (seq !== requestSeq.current) return

        if (!res.success) {
          setEvaluation(defaultMaintenanceState())
          return
        }

        setEvaluation(res.data || defaultMaintenanceState())
      } catch {
        if (seq !== requestSeq.current) return
        // Fail-open supaya user tetap bisa akses kalau API maintenance bermasalah.
        setEvaluation(defaultMaintenanceState())
      } finally {
        if (seq === requestSeq.current) {
          setChecking(false)
        }
      }
    }

    void run()
  }, [bypass, pathname])

  if (!evaluation.active) {
    return <>{children}</>
  }

  const title = evaluation.title?.trim() || 'Halaman Sedang Maintenance'
  const message = evaluation.message?.trim() || 'Sistem lagi maintenance sebentar. Coba lagi beberapa saat ya.'

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141414]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-5 py-14 text-center sm:px-8">
        <div className="mb-4 inline-flex items-center rounded-full border border-[#FF573326] bg-[#FFF0ED] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5733]">
          Maintenance Mode
        </div>

        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-[#141414] sm:text-5xl">{title}</h1>

        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[#666] sm:text-base">{message}</p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-[#FF5733] px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(255,87,51,0.28)] transition hover:-translate-y-0.5 hover:bg-[#D94420]"
            onClick={() => window.location.reload()}
            disabled={checking}
          >
            {checking ? 'Mengecek status...' : 'Coba Lagi'}
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-[#EBEBEB] bg-white px-7 py-3.5 text-sm font-semibold text-[#141414] transition hover:border-[#141414] hover:bg-[#F7F7F5]"
          >
            Kembali ke Home
          </Link>
        </div>

        {evaluation.rule?.target_path && (
          <p className="mt-6 text-xs text-[#888]">
            Target maintenance: <span className="font-semibold">{evaluation.rule.target_path}</span>
          </p>
        )}
      </div>
    </div>
  )
}
