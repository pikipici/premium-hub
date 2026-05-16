"use client"

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
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
  X,
} from 'lucide-react'

import { digiconnectService } from '@/services/digiconnectService'
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

function billingDescriptor(plan: DigiConnectPlan) {
  if (plan.billing_model === 'pay_per_request') return 'Per request sukses'
  if (plan.duration_days) return `Aktif ${plan.duration_days} hari`
  return '-'
}

function compactPlanName(plan: DigiConnectPlan) {
  if (plan.code === 'digiconnect_ppr_hemat') return 'Bayar per Request — Hemat'
  if (plan.code === 'digiconnect_ppr_premium') return 'Bayar per Request — Premium'
  return plan.name
}

function planDescription(plan: DigiConnectPlan) {
  if (plan.description) return plan.description
  if (plan.billing_model === 'pay_per_request') return 'Akses model AI dengan biaya per request. Hanya request sukses yang ditagihkan.'
  if (plan.duration_days) return `Akses DigiConnect aktif ${plan.duration_days} hari untuk workflow intensif.`
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
  const [copyKey, setCopyKey] = useState<string | null>(null)

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
    if (!activePlan || activePlan.available === false) return
    setCheckingOut(true)
    setError(null)
    try {
      const res = await digiconnectService.checkoutWithWallet({ plan_code: activePlan.code })
      setPlanDashboards((prev) => prev.map((item) => item.plan.code === res.data.plan_code ? { ...item, entitlement: res.data } : item))
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Checkout gagal. Pastikan saldo wallet cukup.')
    } finally {
      setCheckingOut(false)
    }
  }

  const copyText = async (label: string, value: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(value)
      setCopyKey(label)
      window.setTimeout(() => setCopyKey((current) => current === label ? null : current), 1500)
    } catch {
      // ignore
    }
  }

  const sampleKey = keys.find((k) => k.status === 'active')?.masked_key || 'dc_live_xxxxxxxxxxxxxxxxxxxx'
  const sampleModel = activePlan?.model_ids?.[0] || activePlan?.model_labels?.[0] || 'kr/claude-opus-4.6'
  const curlSample = `curl ${baseUrl}/digiconnect/chat/completions \\\n  -H "Authorization: Bearer ${sampleKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${sampleModel}","messages":[{"role":"user","content":"halo"}]}'`

  const headline = activePlanDashboard?.dashboard_headline || 'Pusat kontrol DigiConnect'
  const summary = activePlanDashboard?.dashboard_summary || 'Kelola API key, pantau request, dan integrasi DigiConnect dari satu tempat.'

  return (
    <main className="min-h-screen bg-[#FBF8F4] px-3 py-5 text-[#171411] sm:px-5 lg:px-7">
      <section className="mx-auto w-full max-w-6xl space-y-4">

        {tabs.length ? (
          <nav className="rounded-2xl border border-[#EFE3D6] bg-white p-1 shadow-sm">
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex shrink-0 flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 text-left transition ${isActive ? 'bg-[#171411] text-white shadow-sm' : 'text-[#7B7067] hover:bg-[#FFF7F1] hover:text-[#171411]'}`}
                  >
                    <span className="text-[13px] font-bold leading-tight">{tab.label}</span>
                    {tab.badge ? <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-orange-100/80' : 'text-[#A89F94]'}`}>{tab.badge}</span> : null}
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
              <HeadStat label="Biaya" value={currency.format(activeStats?.charged_amount ?? 0)} hint={activeStats?.last_request_at ? relativeTime(activeStats.last_request_at) : undefined} />
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
          <div className="flex items-center justify-center rounded-2xl border border-[#EFE3D6] bg-white py-16 text-[#FF5733]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <section className="rounded-2xl border border-[#EFE3D6] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[#FBF3EC] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PANELS.map((panel) => {
                  const isActive = activePanel === panel.key
                  return (
                    <button
                      key={panel.key}
                      type="button"
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
                <AccessPanel plan={activePlan} entitlement={activePlanEntitlement} checkingOut={checkingOut} onCheckout={checkoutActivePlan} />
              ) : null}

              {activePanel === 'stat' ? (
                <StatsPanel stats={activeStats} requests={activePlanRequests} />
              ) : null}

              {activePanel === 'integrasi' ? (
                <IntegrationPanel baseUrl={baseUrl} sampleKey={sampleKey} curlSample={curlSample} copyKey={copyKey} onCopy={copyText} />
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
                  copyKey={copyKey}
                  onCopy={copyText}
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
                <Empty icon={<Sparkles className="h-5 w-5" />} title="Belum ada request" hint="Kirim panggilan pertama lewat panel Integrasi untuk melihat aktivitas di sini." />
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
    </main>
  )
}

function AccessPanel({ plan, entitlement, checkingOut, onCheckout }: { plan?: DigiConnectPlan; entitlement?: DigiConnectEntitlement; checkingOut: boolean; onCheckout: () => void }) {
  if (!plan) return <Empty icon={<ShieldCheck className="h-5 w-5" />} title="Paket DigiConnect belum tersedia" hint="Coba refresh halaman atau hubungi support kalau masalah berlanjut." />

  const tone = accessTone(plan, entitlement)
  const isStockOut = plan.available === false
  const ctaLabel = entitlement ? 'Aktifkan ulang' : isStockOut ? 'Stok habis' : (plan.cta || 'Aktifkan paket')

  const items: { label: string; value: string }[] = [
    { label: 'Billing', value: billingDescriptor(plan) },
    { label: 'Fair use harian', value: plan.daily_fair_use_limit ? `${plan.daily_fair_use_limit} request` : 'Unlimited' },
    { label: 'Berakhir', value: entitlement?.expires_at ? formatDateOnly(entitlement.expires_at) : (plan.duration_days ? '-' : 'Tanpa expired') },
    { label: 'Stok', value: plan.stock_managed ? `${plan.stock_remaining ?? 0} / ${plan.stock_total ?? 0} tersisa` : 'Tidak terbatas' },
  ]

  const models = plan.model_labels || []
  const features = plan.features || []

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
              disabled={checkingOut || isStockOut}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#FF5733] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#E64A28] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[160px]"
            >
              {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {ctaLabel}
            </button>
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
  const lat = useMemo(() => requests.slice(0, 12).map((r) => r.router_latency_ms || 0).reverse(), [requests])
  const max = Math.max(1, ...lat)
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
            <div className="text-sm font-semibold text-[#7B7067]">{lat.length} request terbaru</div>
          </div>
          <Clock className="h-4 w-4 text-[#A89F94]" />
        </div>
        {lat.length === 0 ? (
          <div className="py-6 text-center text-sm font-semibold text-[#A89F94]">Belum ada data latency.</div>
        ) : (
          <div className="flex h-24 items-end gap-1">
            {lat.map((value, i) => {
              const h = Math.max(4, Math.round((value / max) * 88))
              return (
                <div key={i} className="flex-1 rounded-sm bg-[#FF7048]" style={{ height: `${h}px` }} title={`${value} ms`} />
              )
            })}
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

function IntegrationPanel({ baseUrl, sampleKey, curlSample, copyKey, onCopy }: { baseUrl: string; sampleKey: string; curlSample: string; copyKey: string | null; onCopy: (label: string, value: string) => void }) {
  return (
    <div className="space-y-4">
      <CopyRow label="Base URL" value={`${baseUrl}/digiconnect`} copied={copyKey === 'base'} onCopy={() => onCopy('base', `${baseUrl}/digiconnect`)} />
      <CopyRow label="Authorization header" value={`Authorization: Bearer ${sampleKey}`} mono copied={copyKey === 'auth'} onCopy={() => onCopy('auth', `Authorization: Bearer ${sampleKey}`)} />

      <div className="rounded-xl border border-[#EFE3D6] bg-[#171411] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-orange-100/70">Contoh curl</span>
          <button type="button" onClick={() => onCopy('curl', curlSample)} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-white/20">
            <Copy className="h-3 w-3" /> {copyKey === 'curl' ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre rounded-md bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-orange-50">{curlSample}</pre>
      </div>

      <div className="rounded-xl border border-[#EFE3D6] bg-white p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Endpoint tersedia</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <EndpointChip method="GET" path="/models" />
          <EndpointChip method="POST" path="/chat/completions" />
          <EndpointChip method="POST" path="/responses" />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#7B7067]">
          Pakai base URL ini sebagai endpoint OpenAI-compatible di 9router, AI SDK, atau client lain. Kirim API key DigiConnect sebagai bearer token.
        </p>
      </div>
    </div>
  )
}

function ApiKeyPanel({ keys, newKeyName, setNewKeyName, createdKey, creating, onCreate, onClearCreated, copyKey, onCopy }: { keys: DigiConnectApiKey[]; newKeyName: string; setNewKeyName: (v: string) => void; createdKey: string | null; creating: boolean; onCreate: () => void; onClearCreated: () => void; copyKey: string | null; onCopy: (label: string, value: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#EFE3D6] bg-[#FFFAF5] p-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">Buat API key baru</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.target.value)}
            className="min-h-10 flex-1 rounded-lg border border-[#EFE3D6] bg-white px-3 text-sm font-semibold text-[#171411] outline-none transition focus:border-[#FF5733]"
            placeholder="Nama key, contoh: Production"
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
            <div className="text-sm font-bold text-amber-900">Simpan sekarang. Plain key cuma muncul satu kali.</div>
            <button type="button" onClick={() => onCopy('plain', createdKey)} className="mt-2 inline-flex w-full items-center justify-between gap-2 break-all rounded-md bg-white px-3 py-2 text-left font-mono text-xs text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
              <span className="break-all">{createdKey}</span>
              <Copy className="h-4 w-4 shrink-0" />
            </button>
            <div className="mt-2 text-[11px] font-semibold text-amber-800">{copyKey === 'plain' ? 'Tersalin ke clipboard.' : 'Klik untuk menyalin.'}</div>
          </div>
          <button type="button" onClick={onClearCreated} className="text-amber-700 hover:text-amber-900" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <Empty icon={<Key className="h-5 w-5" />} title="Belum ada API key" hint="Buat satu key untuk mulai memanggil DigiConnect dari aplikasi atau workflow kamu." />
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
              <button
                type="button"
                onClick={() => onCopy(`mask-${key.id}`, key.masked_key)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#EFE3D6] px-2.5 py-1.5 text-xs font-bold text-[#7B7067] transition hover:border-[#FF5733] hover:text-[#FF5733]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copyKey === `mask-${key.id}` ? 'Tersalin' : 'Salin'}
              </button>
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

function CopyRow({ label, value, mono = false, copied, onCopy }: { label: string; value: string; mono?: boolean; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-[#EFE3D6] bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A89F94]">{label}</div>
      <button type="button" onClick={onCopy} className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-md bg-[#FFFAF5] px-3 py-2 text-left text-sm font-semibold text-[#171411] transition hover:bg-[#FFF0EA]">
        <span className={`min-w-0 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#FF5733]">
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Tersalin' : 'Salin'}
        </span>
      </button>
    </div>
  )
}

function EndpointChip({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#EFE3D6] bg-[#FFFAF5] px-2.5 py-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{method}</span>
      <code className="truncate font-mono text-xs font-semibold text-[#171411]">{path}</code>
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
