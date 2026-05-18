"use client"

import type React from 'react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Key,
  Loader2,
  Plug,
  Plus,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'

import { digiconnectService } from '@/services/digiconnectService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import { formatRupiah } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import type {
  DigiConnectApiKey,
  DigiConnectEntitlement,
  DigiConnectPlan,
  DigiConnectPlanDashboard,
  DigiConnectPlanStats,
  DigiConnectPlanTab,
  DigiConnectRequest,
} from '@/types/digiconnect'

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function relativeTime(value?: string | null) {
  if (!value) return '-'
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return '-'
  const diff = Date.now() - target
  if (diff < 0) return formatDate(value)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}d lalu`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}j lalu`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}h lalu`
  return formatDateOnly(value)
}

type Tone = 'success' | 'warn' | 'error' | 'neutral' | 'info'

function statusTone(status: string): Tone {
  const s = (status || '').toLowerCase()
  if (['completed', 'active', 'included', 'charged', 'success'].includes(s)) return 'success'
  if (['processing', 'pending', 'pending_verification'].includes(s)) return 'warn'
  if (['failed', 'cancelled', 'revoked', 'expired'].includes(s)) return 'error'
  if (['inactive', 'disabled'].includes(s)) return 'neutral'
  return 'info'
}

function toneClass(tone: Tone) {
  switch (tone) {
    case 'success': return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'warn': return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'error': return 'bg-rose-50 text-rose-700 ring-rose-200'
    case 'neutral': return 'bg-stone-100 text-stone-600 ring-stone-200'
    case 'info': return 'bg-sky-50 text-sky-700 ring-sky-200'
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: 'Selesai',
    active: 'Aktif',
    inactive: 'Belum aktif',
    processing: 'Diproses',
    pending: 'Menunggu',
    pending_verification: 'Verifikasi',
    failed: 'Gagal',
    cancelled: 'Dibatalkan',
    revoked: 'Dicabut',
    expired: 'Kadaluarsa',
    charged: 'Tertagih',
    included: 'Termasuk',
  }
  return map[(status || '').toLowerCase()] || status || '-'
}

function accessTone(plan?: DigiConnectPlan, entitlement?: DigiConnectEntitlement): Tone {
  if (entitlement) {
    if (entitlement.status === 'active') return 'success'
    if (entitlement.status === 'expired') return 'error'
    return 'info'
  }
  if (plan?.available === false) return 'error'
  return 'neutral'
}

function accessLabel(plan?: DigiConnectPlan, entitlement?: DigiConnectEntitlement) {
  if (entitlement) return entitlement.status === 'active' ? 'Aktif' : statusLabel(entitlement.status)
  if (plan?.available === false) return 'Stok habis'
  return 'Belum aktif'
}

function entitlementDaysLeft(entitlement?: DigiConnectEntitlement): number | null {
  if (!entitlement?.expires_at) return null
  const target = new Date(entitlement.expires_at).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ctaState(plan?: DigiConnectPlan, entitlement?: DigiConnectEntitlement): { label: string; disabled: boolean; tone: 'primary' | 'soft' | 'ghost' } {
  if (!plan) return { label: '-', disabled: true, tone: 'ghost' }
  if (plan.available === false && !entitlement) return { label: 'Stok habis', disabled: true, tone: 'ghost' }
  if (!entitlement) return { label: plan.cta || 'Aktifkan paket', disabled: false, tone: 'primary' }
  const status = entitlement.status
  if (status === 'active') {
    if (plan.billing_model === 'pay_per_request') {
      return { label: 'Sudah aktif', disabled: true, tone: 'soft' }
    }
    const days = entitlementDaysLeft(entitlement)
    if (days !== null && days > 3) return { label: 'Sudah aktif', disabled: true, tone: 'soft' }
    return { label: 'Perpanjang', disabled: plan.available === false, tone: 'primary' }
  }
  if (status === 'expired' || status === 'inactive') return { label: 'Aktifkan ulang', disabled: plan.available === false, tone: 'primary' }
  return { label: plan.cta || 'Aktifkan paket', disabled: plan.available === false, tone: 'primary' }
}

function billingDescriptor(plan: DigiConnectPlan) {
  if (plan.billing_model === 'pay_per_request') return 'Per request sukses'
  if (plan.duration_days) return `Aktif ${plan.duration_days} hari`
  return '-'
}

function compactPlanName(plan: DigiConnectPlan) {
  return plan.name
}

function planDescription(plan: DigiConnectPlan) {
  if (plan.description) return plan.description
  if (plan.billing_model === 'pay_per_request') return 'Bayar per request sukses.'
  if (plan.duration_days) return `Aktif ${plan.duration_days} hari.`
  return 'Akses API DigiConnect.'
}

function shortRequestId(value: string) {
  const normalized = (value || '').replace(/^dc_req_/, '')
  return normalized.length > 8 ? normalized.slice(0, 8) : normalized || '-'
}

function apiBaseUrl() {
  if (typeof window === 'undefined') return '/api/v1'
  return `${window.location.origin}/api/v1`
}

function normalizePlanTabs(plans: DigiConnectPlan[], tabs?: DigiConnectPlanTab[]) {
  if (tabs?.length) return [...tabs].sort((a, b) => a.sort_order - b.sort_order)
  return plans.map((plan, index) => ({
    key: plan.tab_key || plan.code,
    label: plan.tab_label || plan.price_label || plan.name,
    plan_code: plan.code,
    badge: plan.short_name,
    sort_order: index + 1,
  }))
}

function planTabKey(plan: DigiConnectPlan) {
  return plan.tab_key || plan.code
}

type PanelKey = 'akses' | 'stat' | 'integrasi' | 'api-key'

const PANELS: { key: PanelKey; label: string; icon: React.ReactNode }[] = [
  { key: 'akses', label: 'Akses', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'stat', label: 'Statistik', icon: <Activity className="h-4 w-4" /> },
  { key: 'integrasi', label: 'Integrasi', icon: <Plug className="h-4 w-4" /> },
  { key: 'api-key', label: 'API Key', icon: <Key className="h-4 w-4" /> },
]

export default function DigiConnectDashboardPage() {
  const [keys, setKeys] = useState<DigiConnectApiKey[]>([])
  const [planDashboards, setPlanDashboards] = useState<DigiConnectPlanDashboard[]>([])
  const [plans, setPlans] = useState<DigiConnectPlan[]>([])
  const [tabs, setTabs] = useState<DigiConnectPlanTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [activePanel, setActivePanel] = useState<PanelKey>('akses')
  const [checkingOut, setCheckingOut] = useState(false)
  const [newKeyName, setNewKeyName] = useState('Production key')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('/api/v1')
  const [showAllRequests, setShowAllRequests] = useState(false)
  const [activeRequest, setActiveRequest] = useState<DigiConnectRequest | null>(null)
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(() => new Set())
  const isCopied = (label: string) => copiedKeys.has(label)
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)
  const [confirmRevokeKey, setConfirmRevokeKey] = useState<DigiConnectApiKey | null>(null)

  const { isAuthenticated, hasHydrated, isBootstrapped, walletBalance, setWalletBalance } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped

  const { data: walletData } = useQuery({
    queryKey: ['wallet-balance-digiconnect-dashboard'],
    queryFn: async () => {
      const res = await walletService.getBalance()
      return res.data.balance
    },
    enabled: authReady && isAuthenticated,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (typeof walletData === 'number') setWalletBalance(walletData)
  }, [walletData, setWalletBalance])

  const activePlan = useMemo(() => plans.find((plan) => planTabKey(plan) === activeTab) || plans[0], [activeTab, plans])
  const activePlanDashboard = useMemo(() => planDashboards.find((item) => item.plan.code === activePlan?.code), [activePlan?.code, planDashboards])
  const activePlanEntitlement = activePlanDashboard?.entitlement
  const activePlanRequests = useMemo(() => activePlanDashboard?.recent_requests || [], [activePlanDashboard])
  const activeStats = activePlanDashboard?.stats
  const visibleRequests = useMemo(() => showAllRequests ? activePlanRequests : activePlanRequests.slice(0, 5), [showAllRequests, activePlanRequests])

  const load = async () => {
    setError(null)
    try {
      const [summaryRes, keyRes, dashboardRes, planRes] = await Promise.all([
        digiconnectService.getSummary(),
        digiconnectService.listApiKeys(),
        digiconnectService.getDashboard(),
        digiconnectService.publicPlans(),
      ])
      const planData = planRes.data
      const dashboardItems = dashboardRes.data?.plans || []
      const nextPlans = dashboardItems.map((item) => item.plan)
      const fallbackPlans = planData?.plans || []
      const resolvedPlans = nextPlans.length ? nextPlans : fallbackPlans
      const nextTabs = normalizePlanTabs(resolvedPlans, planData?.tabs)
      const preferredPlan = resolvedPlans.find((plan) => plan.code === summaryRes.data?.active_plan_code) || resolvedPlans.find((plan) => dashboardItems.some((item) => item.plan.code === plan.code && item.entitlement?.status === 'active'))
      setKeys(keyRes.data || [])
      setPlanDashboards(dashboardItems)
      setPlans(resolvedPlans)
      setTabs(nextTabs)
      setActiveTab((current) => current || (preferredPlan ? planTabKey(preferredPlan) : planData?.default_tab || nextTabs[0]?.key || ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat DigiConnect')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setBaseUrl(apiBaseUrl())
    void load()
  }, [])

  useEffect(() => { setShowAllRequests(false) }, [activeTab])

  const createKey = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await digiconnectService.createApiKey(newKeyName)
      setCreatedKey(res.data.plain_key || null)
      setKeys((prev) => [res.data, ...prev])
      setNewKeyName('Production key')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat API key')
    } finally {
      setCreating(false)
    }
  }

  const checkoutActivePlan = async () => {
    if (!activePlan) return
    const cta = ctaState(activePlan, activePlanEntitlement)
    if (cta.disabled) return
    setCheckingOut(true)
    setError(null)
    try {
      const res = await digiconnectService.checkoutWithWallet({ plan_code: activePlan.code })
      setPlanDashboards((prev) => prev.map((item) => item.plan.code === res.data.plan_code ? { ...item, entitlement: res.data } : item))
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Checkout gagal. Saldo wallet kurang.')
    } finally {
      setCheckingOut(false)
    }
  }

  const revokeKey = async (id: string) => {
    setRevokingKeyId(id)
    setError(null)
    try {
      const res = await digiconnectService.revokeApiKey(id)
      setKeys((prev) => prev.map((k) => k.id === id ? res.data : k))
      setConfirmRevokeKey(null)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Gagal mencabut API key')
    } finally {
      setRevokingKeyId(null)
    }
  }

  const copyText = async (label: string, value: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKeys((prev) => {
        const next = new Set(prev)
        next.add(label)
        return next
      })
      window.setTimeout(() => {
        setCopiedKeys((prev) => {
          if (!prev.has(label)) return prev
          const next = new Set(prev)
          next.delete(label)
          return next
        })
      }, 1500)
    } catch {
      // ignore
    }
  }

  const sampleKey = keys.find((k) => k.status === 'active')?.masked_key || 'dc_live_xxxxxxxxxxxxxxxxxxxx'
  const sampleModel = activePlan?.model_ids?.[0] || activePlan?.model_labels?.[0] || 'kr/claude-opus-4.6'
  const curlSample = `curl ${baseUrl}/digiconnect/chat/completions \\\n  -H "Authorization: Bearer ${sampleKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${sampleModel}","messages":[{"role":"user","content":"halo"}]}'`

  const headline = activePlanDashboard?.dashboard_headline || 'Pusat kontrol DigiConnect'
  const summary = activePlanDashboard?.dashboard_summary || 'API key, request, dan integrasi—satu tempat.'

  return (
    <div className="text-[#171411]">
      <section className="mx-auto w-full max-w-6xl space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#7B7067] ring-1 ring-[#EFE3D6] transition hover:bg-[#FFF7F1] hover:text-[#171411]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#A89F94]">DigiConnect</span>
          </div>
          {authReady && isAuthenticated ? (
            <Link
              href="/dashboard/wallet"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3EF] px-3 py-1.5 text-xs font-bold text-[#FF5733] ring-1 ring-[#FFD9CF] transition hover:bg-[#FFE4DA]"
              title="Saldo wallet"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Saldo</span>
              <span className="font-mono">{formatRupiah(walletBalance)}</span>
            </Link>
          ) : null}
        </div>

        {tabs.length ? (
          <nav role="tablist" aria-label="Pilih paket DigiConnect" className="rounded-2xl border border-[#EFE3D6] bg-white p-1 shadow-sm">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex shrink-0 flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 text-left transition ${isActive ? 'bg-[#171411] text-white shadow-sm' : 'text-[#7B7067] hover:bg-[#FFF7F1] hover:text-[#171411]'}`}
                  >
                    <span className="text-[13px] font-bold leading-tight">{tab.badge || tab.label}</span>
                    {tab.badge ? (
                      <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-orange-100/80' : 'text-[#A89F94]'}`}>{tab.label}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </nav>
        ) : null}

        <header className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF0EA] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#B73B20]">
                <RadioTower className="h-3.5 w-3.5" /> DigiConnect
              </div>
              <h1 className="mt-2 text-xl font-bold tracking-tight text-[#171411] sm:text-2xl">{headline}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#7B7067]">{summary}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[420px] lg:shrink-0">
              <HeadStat label="Status" value={activePlanEntitlement ? statusLabel(activePlanEntitlement.status) : 'Belum aktif'} tone={accessTone(activePlan, activePlanEntitlement)} />
              <HeadStat label="Request" value={String(activeStats?.total_requests ?? 0)} hint={activeStats?.completed_count ? `${activeStats.completed_count} sukses` : undefined} />
              <HeadStat label="Biaya" value={currency.format(activeStats?.charged_amount ?? 0)} hint={activeStats?.last_request_at ? `Update ${relativeTime(activeStats.last_request_at)}` : undefined} />
            </div>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <section className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
              <div role="tablist" aria-label="Panel kontrol" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[#FBF3EC] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PANELS.map((panel) => {
                  const isActive = activePanel === panel.key
                  return (
                    <button
                      key={panel.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActivePanel(panel.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${isActive ? 'bg-white text-[#171411] shadow-sm ring-1 ring-[#EFE3D6]' : 'text-[#7B7067] hover:text-[#171411]'}`}
                    >
                      {panel.icon}
                      {panel.label}
                    </button>
                  )
                })}
              </div>

              {activePanel === 'akses' ? (
                <AccessPanel plan={activePlan} entitlement={activePlanEntitlement} checkingOut={checkingOut} walletBalance={walletBalance} onCheckout={checkoutActivePlan} />
              ) : null}

              {activePanel === 'stat' ? (
                <StatsPanel stats={activeStats} requests={activePlanRequests} />
              ) : null}

              {activePanel === 'integrasi' ? (
                <IntegrationPanel baseUrl={baseUrl} sampleKey={sampleKey} sampleModel={sampleModel} curlSample={curlSample} isCopied={isCopied} onCopy={copyText} hasActiveKey={keys.some((k) => k.status === 'active')} onGoToApiKey={() => setActivePanel('api-key')} />
              ) : null}

              {activePanel === 'api-key' ? (
                <ApiKeyPanel
                  keys={keys}
                  newKeyName={newKeyName}
                  setNewKeyName={setNewKeyName}
                  createdKey={createdKey}
                  creating={creating}
                  onCreate={createKey}
                  onClearCreated={() => setCreatedKey(null)}
                  isCopied={isCopied}
                  onCopy={copyText}
                  revokingKeyId={revokingKeyId}
                  onRequestRevoke={(key) => setConfirmRevokeKey(key)}
                />
              ) : null}
            </section>

            <section className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0EA] text-[#FF5733]"><Activity className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-bold text-[#171411]">Request terbaru</div>
                    <div className="text-xs font-semibold text-[#A89F94]">{activePlanRequests.length} entri</div>
                  </div>
                </div>
                {activePlanRequests.length > 5 ? (
                  <button type="button" onClick={() => setShowAllRequests((v) => !v)} className="text-xs font-bold text-[#FF5733] hover:underline">
                    {showAllRequests ? 'Sembunyikan' : `Lihat semua (${activePlanRequests.length})`}
                  </button>
                ) : null}
              </div>

              {visibleRequests.length === 0 ? (
                <Empty icon={<Sparkles className="h-5 w-5" />} title="Belum ada request" hint="Kirim panggilan pertama dari panel Integrasi." />
              ) : (
                <div className="space-y-2">
                  {visibleRequests.map((request) => (
                    <RequestRow key={request.id} request={request} onClick={() => setActiveRequest(request)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>

      {activeRequest ? <RequestDetail request={activeRequest} onClose={() => setActiveRequest(null)} /> : null}
      {confirmRevokeKey ? (
        <ConfirmDialog
          open
          title="Cabut API key?"
          description={
            <>
              Key <span className="font-bold text-[#141414]">{confirmRevokeKey.name}</span> akan langsung tidak bisa dipakai. Aplikasi yang masih pakai key ini akan dapat 401 Unauthorized.
            </>
          }
          preview={
            <div className="truncate rounded-md bg-[#FFFAF5] px-2 py-1 font-mono text-xs text-[#7B7067] ring-1 ring-[#EFE3D6]">
              {confirmRevokeKey.masked_key}
            </div>
          }
          confirmLabel="Ya, cabut"
          cancelLabel="Batal"
          destructive
          loading={revokingKeyId === confirmRevokeKey.id}
          onCancel={() => setConfirmRevokeKey(null)}
          onConfirm={() => void revokeKey(confirmRevokeKey.id)}
        />
      ) : null}
    </div>
  )
}

function AccessPanel({ plan, entitlement, checkingOut, walletBalance, onCheckout }: { plan?: DigiConnectPlan; entitlement?: DigiConnectEntitlement; checkingOut: boolean; walletBalance: number; onCheckout: () => void }) {
  if (!plan) return <Empty icon={<ShieldCheck className="h-5 w-5" />} title="Paket DigiConnect belum tersedia" hint="Refresh halaman atau hubungi support." />

  const tone = accessTone(plan, entitlement)
  const cta = ctaState(plan, entitlement)
  const planPrice = plan.price ?? 0
  const oneShotPlan = plan.billing_model !== 'pay_per_request' && planPrice > 0
  const insufficient = oneShotPlan && cta.tone === 'primary' && !cta.disabled && walletBalance < planPrice
  const ctaDisabled = cta.disabled || checkingOut || insufficient

  const items: { label: string; value: string }[] = [
    { label: 'Billing', value: billingDescriptor(plan) },
    { label: 'Fair use', value: plan.daily_fair_use_limit ? `${plan.daily_fair_use_limit} request` : 'Unlimited' },
    { label: 'Berakhir', value: entitlement?.expires_at ? formatDateOnly(entitlement.expires_at) : (plan.duration_days ? '-' : 'Tanpa kadaluarsa') },
    { label: 'Stok', value: plan.stock_managed ? `${plan.stock_remaining ?? 0} / ${plan.stock_total ?? 0} tersisa` : 'Tidak terbatas' },
  ]

  const models = plan.model_labels || []
  const features = plan.features || []
  const ctaClass = cta.tone === 'soft'
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : cta.tone === 'ghost'
      ? 'bg-stone-100 text-stone-500 ring-1 ring-stone-200'
      : 'bg-[#FF5733] text-white shadow-sm hover:bg-[#E64A28]'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone}>{accessLabel(plan, entitlement)}</Pill>
              {plan.short_name ? <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7B7067] ring-1 ring-[#EFE3D6]">{plan.short_name}</span> : null}
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-[#171411] sm:text-xl">{compactPlanName(plan)}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#7B7067]">{planDescription(plan)}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A89F94]">Harga</div>
              <div className="text-lg font-bold text-[#171411]">{plan.price_label || currency.format(plan.price)}</div>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              disabled={ctaDisabled}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[160px] ${ctaClass}`}
            >
              {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {insufficient ? 'Saldo kurang' : cta.label}
            </button>
            {insufficient ? (
              <Link href="/dashboard/wallet" className="text-right text-[11px] font-bold text-[#FF5733] underline-offset-2 hover:underline">
                Topup wallet ({formatRupiah(planPrice - walletBalance)} kurang)
              </Link>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid gap-x-4 gap-y-2 border-t border-[#EFE3D6] pt-3 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="font-semibold text-[#7B7067]">{item.label}</dt>
              <dd className="text-right font-bold text-[#171411]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {(features.length || models.length) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {features.length ? (
            <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Yang termasuk</div>
              <ul className="space-y-1.5">
                {features.slice(0, 5).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#3F3A35]">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {models.length ? (
            <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Model tersedia</div>
              <div className="flex flex-wrap gap-1.5">
                {models.slice(0, 8).map((model) => (
                  <span key={model} className="rounded-md bg-[#FFF0EA] px-2 py-1 font-mono text-[11px] font-semibold text-[#B73B20]">{model}</span>
                ))}
                {models.length > 8 ? <span className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-bold text-[#7B7067]">+{models.length - 8}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StatsPanel({ stats, requests }: { stats?: DigiConnectPlanStats; requests: DigiConnectRequest[] }) {
  const recentBars = useMemo(() => requests.slice(0, 12).map((r) => ({ value: r.router_latency_ms || 0, status: r.status, createdAt: r.created_at })).reverse(), [requests])
  const max = Math.max(1, ...recentBars.map((b) => b.value))
  const totalReq = stats?.total_requests ?? 0
  const successRate = totalReq ? Math.round(((stats?.completed_count ?? 0) / totalReq) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat label="Total request" value={String(totalReq)} />
        <BigStat label="Sukses" value={String(stats?.completed_count ?? 0)} hint={totalReq ? `${successRate}%` : undefined} />
        <BigStat label="Avg latency" value={stats?.avg_latency_ms ? `${stats.avg_latency_ms} ms` : '-'} />
        <BigStat label="Total biaya" value={currency.format(stats?.charged_amount ?? 0)} />
      </div>

      <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Latency request terakhir</div>
            <div className="text-sm font-semibold text-[#7B7067]">{recentBars.length} request terbaru · skala maks {max} ms</div>
          </div>
          <Clock className="h-4 w-4 text-[#A89F94]" />
        </div>
        {recentBars.length === 0 ? (
          <div className="py-6 text-center text-sm font-semibold text-[#A89F94]">Belum ada data latency.</div>
        ) : (
          <div>
            <div className="flex h-24 items-end gap-1">
              {recentBars.map((bar, i) => {
                const h = Math.max(4, Math.round((bar.value / max) * 88))
                const tone = statusTone(bar.status)
                const barColor = tone === 'success' ? 'bg-emerald-500' : tone === 'error' ? 'bg-rose-500' : tone === 'warn' ? 'bg-amber-400' : 'bg-stone-300'
                const ts = bar.createdAt ? relativeTime(bar.createdAt) : ''
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${barColor}`}
                    style={{ height: `${h}px` }}
                    title={`${bar.value} ms · ${statusLabel(bar.status)}${ts ? ` · ${ts}` : ''}`}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#7B7067]">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Sukses</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" /> Gagal</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> Diproses</span>
              <span className="ml-auto font-mono">unit: ms</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] px-4 py-3 text-sm">
        <span className="font-semibold text-[#7B7067]">Request terakhir</span>
        <span className="font-bold text-[#171411]">{stats?.last_request_at ? relativeTime(stats.last_request_at) : 'Belum ada'}</span>
      </div>
    </div>
  )
}

function IntegrationPanel({ baseUrl, sampleKey, sampleModel, curlSample, isCopied, onCopy, hasActiveKey, onGoToApiKey }: { baseUrl: string; sampleKey: string; sampleModel: string; curlSample: string; isCopied: (label: string) => boolean; onCopy: (label: string, value: string) => void; hasActiveKey: boolean; onGoToApiKey: () => void }) {
  const [lang, setLang] = useState<'curl' | 'node' | 'python'>('curl')
  const fullBase = `${baseUrl}/digiconnect`
  const envSnippet = `OPENAI_BASE_URL=${fullBase}\nOPENAI_API_KEY=${sampleKey}`
  const nodeSnippet = `import OpenAI from 'openai'\n\nconst client = new OpenAI({\n  baseURL: '${fullBase}',\n  apiKey: process.env.OPENAI_API_KEY,\n})\n\nconst res = await client.chat.completions.create({\n  model: '${sampleModel}',\n  messages: [{ role: 'user', content: 'halo' }],\n})\n\nconsole.log(res.choices[0].message.content)`
  const pythonSnippet = `import os\nfrom openai import OpenAI\n\nclient = OpenAI(\n    base_url="${fullBase}",\n    api_key=os.environ["OPENAI_API_KEY"],\n)\n\nres = client.chat.completions.create(\n    model="${sampleModel}",\n    messages=[{"role": "user", "content": "halo"}],\n)\nprint(res.choices[0].message.content)`
  const snippets: Record<typeof lang, string> = { curl: curlSample, node: nodeSnippet, python: pythonSnippet }
  const activeSnippet = snippets[lang]

  return (
    <div className="space-y-4">
      {!hasActiveKey ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <Key className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            Belum ada API key aktif. Contoh di bawah pakai placeholder.
          </div>
          <button type="button" onClick={onGoToApiKey} className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 hover:bg-amber-200">
            Buat key
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold text-[#171411]">1. Konfigurasi</div>
          <span className="text-[11px] font-semibold text-[#A89F94]">OpenAI-compatible</span>
        </div>
        <div className="space-y-3">
          <ConfigField label="Base URL" value={fullBase} copied={isCopied('base')} onCopy={() => onCopy('base', fullBase)} />
          <ConfigField label="API key" value={sampleKey} copied={isCopied('auth')} onCopy={() => onCopy('auth', sampleKey)} placeholder={!hasActiveKey} />
          <div className="rounded-lg bg-[#FFFAF5] p-3 ring-1 ring-[#EFE3D6]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A89F94]">Untuk .env</span>
              <button type="button" onClick={() => onCopy('env', envSnippet)} aria-label="Salin .env snippet" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5733] hover:text-[#E64A28]">
                <Copy className="h-3 w-3" /> {isCopied('env') ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-[#171411]">{envSnippet}</pre>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
        <div className="mb-3 text-sm font-bold text-[#171411]">2. Endpoint</div>
        <div className="space-y-2">
          <EndpointRow method="POST" path="/chat/completions" desc="Multi-turn chat dengan messages array. Paling umum dipakai." />
          <EndpointRow method="POST" path="/responses" desc="Stateful response API untuk agent / multi-step reasoning." />
          <EndpointRow method="GET" path="/models" desc="List model yang tersedia untuk plan kamu." />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#EFE3D6] bg-[#171411]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-1" role="tablist" aria-label="Bahasa quick start">
            <LangTab active={lang === 'curl'} onClick={() => setLang('curl')}>curl</LangTab>
            <LangTab active={lang === 'node'} onClick={() => setLang('node')}>Node.js</LangTab>
            <LangTab active={lang === 'python'} onClick={() => setLang('python')}>Python</LangTab>
          </div>
          <button type="button" onClick={() => onCopy('snippet', activeSnippet)} aria-label="Salin snippet" className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-white/20">
            <Copy className="h-3 w-3" /> {isCopied('snippet') ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre p-3 font-mono text-[11px] leading-relaxed text-orange-50">{activeSnippet}</pre>
      </div>
    </div>
  )
}

function ConfigField({ label, value, copied, onCopy, placeholder = false }: { label: string; value: string; copied: boolean; onCopy: () => void; placeholder?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A89F94]">{label}</span>
        <button type="button" onClick={onCopy} aria-label={`Salin ${label}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5733] hover:text-[#E64A28]">
          <Copy className="h-3 w-3" /> {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <div className={`break-all rounded-md border border-[#EFE3D6] bg-[#FFFAF5] px-3 py-2 font-mono text-xs ${placeholder ? 'text-[#A89F94]' : 'text-[#171411]'}`} aria-live="polite">
        {value}
      </div>
    </div>
  )
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodCls = method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-[#EFE3D6] bg-[#FFFAF5] p-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 sm:w-44 sm:shrink-0">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${methodCls}`}>{method}</span>
        <code className="font-mono text-xs font-semibold text-[#171411]">{path}</code>
      </div>
      <p className="text-xs leading-relaxed text-[#7B7067]">{desc}</p>
    </div>
  )
}

function LangTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${active ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white/90'}`}
    >
      {children}
    </button>
  )
}

function ApiKeyPanel({ keys, newKeyName, setNewKeyName, createdKey, creating, onCreate, onClearCreated, isCopied, onCopy, revokingKeyId, onRequestRevoke }: { keys: DigiConnectApiKey[]; newKeyName: string; setNewKeyName: (v: string) => void; createdKey: string | null; creating: boolean; onCreate: () => void; onClearCreated: () => void; isCopied: (label: string) => boolean; onCopy: (label: string, value: string) => void; revokingKeyId: string | null; onRequestRevoke: (key: DigiConnectApiKey) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] p-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Buat API key baru</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            className="min-h-10 flex-1 rounded-lg border border-[#EFE3D6] bg-white px-3 text-sm font-semibold text-[#171411] outline-none transition focus:border-[#FF5733]"
            placeholder="Nama key, mis. Production"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={creating || !newKeyName.trim()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#FF5733] px-4 text-sm font-bold text-white transition hover:bg-[#E64A28] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Buat key
          </button>
        </div>
      </div>

      {createdKey ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-amber-900">Plain key muncul sekali. Simpan sekarang.</div>
            <button type="button" onClick={() => onCopy('plain', createdKey)} className="mt-2 inline-flex w-full items-center justify-between gap-2 break-all rounded-md bg-white px-3 py-2 text-left font-mono text-xs text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              <span className="break-all">{createdKey}</span>
              <Copy className="h-4 w-4 shrink-0" />
            </button>
            <div className="mt-2 text-[11px] font-semibold text-amber-800">{isCopied('plain') ? 'Tersalin.' : 'Klik untuk salin.'}</div>
          </div>
          <button type="button" onClick={onClearCreated} className="text-amber-700 hover:text-amber-900" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <Empty icon={<Key className="h-5 w-5" />} title="Belum ada API key" hint="Buat key untuk mulai panggil DigiConnect." />
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex flex-col gap-2 rounded-xl border border-[#EFE3D6] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#171411]">{key.name}</span>
                  <Pill tone={statusTone(key.status)}>{statusLabel(key.status)}</Pill>
                </div>
                <div className="mt-1 truncate font-mono text-xs font-semibold text-[#7B7067]">{key.masked_key}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#A89F94]">
                  <span>Dibuat {formatDateOnly(key.created_at)}</span>
                  <span>•</span>
                  <span>Terakhir dipakai {key.last_used_at ? relativeTime(key.last_used_at) : 'belum'}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onCopy(`mask-${key.id}`, key.masked_key)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#EFE3D6] px-2.5 py-1.5 text-xs font-bold text-[#7B7067] transition hover:border-[#FF5733] hover:text-[#FF5733]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isCopied(`mask-${key.id}`) ? 'Tersalin' : 'Salin'}
                </button>
                {key.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => onRequestRevoke(key)}
                    disabled={revokingKeyId === key.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Cabut API key ini"
                  >
                    {revokingKeyId === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Cabut
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RequestRow({ request, onClick }: { request: DigiConnectRequest; onClick: () => void }) {
  const tone = statusTone(request.status)
  const modelLabel = [request.router_provider, request.router_model].filter(Boolean).join(' / ')
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-xl border border-[#EFE3D6] bg-white p-3 text-left transition hover:border-[#FF5733]/40 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <Pill tone={tone}>{statusLabel(request.status)}</Pill>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[#171411]" title={request.request_id}>#{shortRequestId(request.request_id)}</span>
            <span className="text-[11px] font-semibold text-[#A89F94]">{relativeTime(request.created_at)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[#3F3A35]">{request.input_preview || request.service_alias || '-'}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#7B7067]">
            <span>{request.router_latency_ms ? `${request.router_latency_ms} ms` : '-'}</span>
            <span>•</span>
            <span>{request.amount ? currency.format(request.amount) : 'Gratis'}</span>
            {modelLabel ? <><span>•</span><span className="font-mono">{modelLabel}</span></> : null}
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#A89F94]" />
      </div>
    </button>
  )
}

function RequestDetail({ request, onClose }: { request: DigiConnectRequest; onClose: () => void }) {
  const tone = statusTone(request.status)
  const modelLabel = [request.router_provider, request.router_model].filter(Boolean).join(' / ') || '-'
  const items: { label: string; value: string }[] = [
    { label: 'Status', value: statusLabel(request.status) },
    { label: 'Service', value: request.service_alias || '-' },
    { label: 'Model', value: modelLabel },
    { label: 'Latency', value: request.router_latency_ms ? `${request.router_latency_ms} ms` : '-' },
    { label: 'Router HTTP', value: request.router_status ? String(request.router_status) : '-' },
    { label: 'Billing', value: `${request.billing_decision || '-'} (${request.billing_source || '-'})` },
    { label: 'Biaya', value: request.amount ? currency.format(request.amount) : '-' },
    { label: 'Started', value: formatDate(request.started_at) },
    { label: 'Completed', value: formatDate(request.completed_at) },
    { label: 'Created', value: formatDate(request.created_at) },
  ]
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Pill tone={tone}>{statusLabel(request.status)}</Pill>
              <span className="font-mono text-xs font-bold text-[#7B7067]">#{shortRequestId(request.request_id)}</span>
            </div>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-[#171411]">Detail request</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#7B7067] hover:bg-stone-100 hover:text-[#171411]" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A89F94]">Input preview</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#3F3A35]">{request.input_preview || '-'}</p>
        </div>

        {request.public_error_code ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">Error</div>
              <code className="font-mono text-xs">{request.public_error_code}</code>
            </div>
          </div>
        ) : null}

        <dl className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#EFE3D6] pb-1 text-sm">
              <dt className="font-semibold text-[#7B7067]">{item.label}</dt>
              <dd className="text-right font-bold text-[#171411]">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function HeadStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: Tone }) {
  const valueColor = tone === 'success' ? 'text-emerald-700' : tone === 'error' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-700' : 'text-[#171411]'
  return (
    <div className="rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#A89F94]">{label}</div>
      <div className={`mt-1 truncate text-sm font-bold ${valueColor}`}>{value}</div>
      {hint ? <div className="mt-0.5 truncate text-[11px] font-semibold text-[#A89F94]">{hint}</div> : null}
    </div>
  )
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A89F94]">{label}</div>
      <div className="mt-1 truncate text-xl font-bold text-[#171411]">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">{hint}</div> : null}
    </div>
  )
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${toneClass(tone)}`}>{children}</span>
}

function Empty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E7DDD1] bg-[#FBF8F4] px-4 py-8 text-center">
      <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0EA] text-[#FF5733]">{icon}</div>
      <div className="text-sm font-bold text-[#171411]">{title}</div>
      {hint ? <div className="mt-1 max-w-sm text-xs font-semibold text-[#7B7067]">{hint}</div> : null}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" aria-busy="true" aria-live="polite">
      <section className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 h-9 w-full max-w-sm animate-pulse rounded-xl bg-[#FBF3EC]" />
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-[#FFFAF5]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-xl bg-[#FBF3EC]" />
            <div className="h-28 animate-pulse rounded-xl bg-[#FBF3EC]" />
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 h-6 w-40 animate-pulse rounded-md bg-[#FBF3EC]" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#FBF3EC]" />
          ))}
        </div>
      </section>
    </div>
  )
}
