"use client"

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, Copy, Globe2, KeyRound, Loader2, Plus, RadioTower, Sparkles, WalletCards } from 'lucide-react'

import { digiconnectService } from '@/services/digiconnectService'
import type { DigiConnectApiKey, DigiConnectEntitlement, DigiConnectPlan, DigiConnectPlanDashboard, DigiConnectPlanTab } from '@/types/digiconnect'

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (['completed', 'active', 'included', 'charged'].includes(normalized)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (['processing', 'pending_verification'].includes(normalized)) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-rose-50 text-rose-700 ring-rose-200'
}

const planLabels: Record<string, string> = {
  digiconnect_ppr_hemat: 'Bayar per Request Hemat',
  digiconnect_ppr_premium: 'Bayar per Request Premium',
  digiconnect_2d: 'Paket 2 Hari',
}

function planLabel(code?: string | null) {
  if (!code) return '-'
  return planLabels[code] || code
}

function planPricing(entitlement?: DigiConnectEntitlement) {
  if (!entitlement) return '-'
  if (entitlement.billing_model === 'pay_per_request') return `${currency.format(entitlement.price)}/request`
  if (entitlement.expires_at) return 'Paket aktif'
  return currency.format(entitlement.price)
}

function apiRequestUrl() {
  if (typeof window === 'undefined') return '/api/v1'
  return `${window.location.origin}/api/v1`
}

function shortRequestId(value: string) {
  const normalized = value.replace(/^dc_req_/, '')
  return normalized.length > 8 ? normalized.slice(0, 8) : normalized
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

export default function DigiConnectDashboardPage() {
  const [keys, setKeys] = useState<DigiConnectApiKey[]>([])
  const [planDashboards, setPlanDashboards] = useState<DigiConnectPlanDashboard[]>([])
  const [plans, setPlans] = useState<DigiConnectPlan[]>([])
  const [tabs, setTabs] = useState<DigiConnectPlanTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [newKeyName, setNewKeyName] = useState('Production key')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('/api/v1/digiconnect/requests')

  const activePlan = useMemo(() => plans.find((plan) => planTabKey(plan) === activeTab) || plans[0], [activeTab, plans])
  const activePlanDashboard = useMemo(() => planDashboards.find((item) => item.plan.code === activePlan?.code), [activePlan?.code, planDashboards])
  const activePlanEntitlement = activePlanDashboard?.entitlement
  const activePlanRequests = activePlanDashboard?.recent_requests || []
  const activeStats = activePlanDashboard?.stats

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
    setBaseUrl(apiRequestUrl())
    void load()
  }, [])

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
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || 'Checkout gagal. Pastikan saldo wallet cukup.')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F4EE] px-3 py-5 text-[#171411] sm:px-5 lg:px-7">
      <section className="mx-auto w-full max-w-6xl space-y-5">
        {tabs.length ? (
          <div className="mx-auto max-w-2xl rounded-[24px] border border-[#F0D8C8] bg-white/90 p-1.5 shadow-lg shadow-orange-950/5 backdrop-blur">
            <div className="grid grid-cols-3 gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`min-w-0 rounded-[18px] px-2.5 py-2.5 text-left transition sm:px-4 sm:py-3 ${activeTab === tab.key ? 'bg-[#171411] text-white shadow-xl shadow-orange-950/20' : 'bg-[#FFF7F1] text-[#7B7067] hover:bg-white hover:text-[#FF5733]'}`}
                >
                  <span className="block truncate text-xs font-black sm:text-sm">{tab.label}</span>
                  {tab.badge ? <span className="mt-1 block truncate text-[11px] font-bold opacity-70 sm:text-xs">{tab.badge}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-[#F0D8C8] bg-[linear-gradient(135deg,#24140D,#B73B20_58%,#FF7048)] p-5 text-white shadow-xl shadow-orange-950/10 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-50 ring-1 ring-white/20">
                <RadioTower className="h-4 w-4" /> DigiConnect API
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{activePlanDashboard?.dashboard_headline || 'Pusat kontrol AI API kamu'}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-orange-50/88 sm:text-base">
                {activePlanDashboard?.dashboard_summary || 'Kelola API key, pantau entitlement, dan cek request terbaru sebelum integrasi ke app atau workflow eksternal.'}
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-3 lg:w-[340px] lg:shrink-0">
              <Stat label="Status" value={activePlanEntitlement?.status || 'inactive'} />
              <Stat label="Request" value={String(activeStats?.total_requests ?? 0)} />
              <Stat label="Sukses" value={String(activeStats?.completed_count ?? 0)} />
              <Stat label="Biaya" value={currency.format(activeStats?.charged_amount ?? 0)} />
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl bg-white py-16 text-[#FF5733]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.85fr_1.15fr]">
            <section className="space-y-6">
              <Card title="Pilih akses DigiConnect" icon={<Sparkles className="h-5 w-5" />}>
                {plans.length ? (
                  <div className="space-y-4">
                    {activePlan ? (
                      <div className="overflow-hidden rounded-3xl border border-[#F0D8C8] bg-[linear-gradient(135deg,#FFF8F2,#FFFFFF)]">
                        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[1fr_auto] xl:items-start">
                          <div className="min-w-0">
                            <div className="inline-flex rounded-full bg-[#FFE7DD] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#B73B20]">{activePlan.short_name || activePlan.name}</div>
                            <h2 className="mt-3 text-2xl font-black text-[#171411]">{activePlan.name}</h2>
                            <p className="mt-2 text-sm font-semibold leading-6 text-[#7B7067]">{activePlan.description}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <MiniLight label="Harga" value={activePlan.price_label || currency.format(activePlan.price)} />
                              <MiniLight label="Billing" value={activePlan.billing_model === 'pay_per_request' ? 'Per request sukses' : `${activePlan.duration_days} hari`} />
                              <MiniLight label="Status" value={activePlanEntitlement ? 'Aktif' : activePlan.available === false ? 'Stok habis' : 'Belum aktif'} />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={checkoutActivePlan}
                            disabled={checkingOut || activePlan.available === false}
                            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#FF5733] px-5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
                          >
                            {checkingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {activePlanEntitlement ? 'Aktifkan lagi' : activePlan.available === false ? 'Stok habis' : activePlan.cta || 'Checkout paket'}
                          </button>
                        </div>
                        <div className="grid gap-3 border-t border-[#F0D8C8] bg-white/70 p-5 lg:grid-cols-[1fr_0.9fr]">
                          <div className="space-y-2">
                            {(activePlan.features || []).map((feature) => (
                              <div key={feature} className="flex items-center gap-2 text-sm font-bold text-[#4C463F]"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> {feature}</div>
                            ))}
                          </div>
                          <div>
                            {activePlan.stock_managed ? <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-900">Stok tersisa {activePlan.stock_remaining ?? 0}/{activePlan.stock_total ?? 0}</div> : null}
                            <div className="flex flex-wrap gap-2">
                              {(activePlan.model_labels || []).slice(0, 7).map((label) => <span key={label} className="rounded-full bg-[#FFF0EA] px-3 py-1 text-xs font-bold text-[#A15A40]">{label}</span>)}
                              {(activePlan.model_labels?.length || 0) > 7 ? <span className="rounded-full bg-[#171411] px-3 py-1 text-xs font-bold text-white">+{(activePlan.model_labels?.length || 0) - 7} model</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : <Empty text="Paket DigiConnect belum tersedia." />}
              </Card>

              <Card title="Stat tab aktif" icon={<Activity className="h-5 w-5" />}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniLight label="Total request" value={String(activeStats?.total_requests ?? 0)} />
                  <MiniLight label="Request sukses" value={String(activeStats?.completed_count ?? 0)} />
                  <MiniLight label="Rata-rata latency" value={activeStats?.avg_latency_ms ? `${activeStats.avg_latency_ms} ms` : '-'} />
                  <MiniLight label="Request terakhir" value={formatDate(activeStats?.last_request_at)} />
                </div>
              </Card>

              <Card title="OpenAI-compatible Base URL" icon={<Globe2 className="h-5 w-5" />}>
                <div className="rounded-2xl bg-[#FFF7F1] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A15A40]">Base URL untuk 9router</div>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(baseUrl)} className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-[#F0D8C8] bg-white px-3 py-3 text-left font-mono text-xs font-bold text-[#171411] transition hover:border-[#FF5733]">
                    <span className="break-all">{baseUrl}</span>
                    <Copy className="h-4 w-4 shrink-0 text-[#FF5733]" />
                  </button>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-[#7B7067] sm:grid-cols-3">
                    <code className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#F0D8C8]">GET /models</code>
                    <code className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#F0D8C8]">POST /chat/completions</code>
                    <code className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#F0D8C8]">POST /responses</code>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#7B7067]">Paste base URL ini ke 9router OpenAI Compatible Chat atau Responses dan pakai API key DigiConnect sebagai bearer token.</p>
                </div>
              </Card>

              <Card title="API key" icon={<KeyRound className="h-5 w-5" />}>
                <div className="flex flex-col gap-3 rounded-2xl bg-[#FFF7F1] p-3 sm:flex-row">
                  <input
                    value={newKeyName}
                    onChange={(event) => setNewKeyName(event.target.value)}
                    className="min-h-11 flex-1 rounded-xl border border-[#F0D8C8] bg-white px-4 text-sm font-semibold outline-none focus:border-[#FF5733]"
                    placeholder="Nama key"
                  />
                  <button
                    type="button"
                    onClick={createKey}
                    disabled={creating}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 text-sm font-bold text-white shadow-lg shadow-orange-500/20 disabled:opacity-60"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Buat key
                  </button>
                </div>
                {createdKey ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="font-bold">Simpan sekarang. Plain key cuma muncul sekali.</div>
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(createdKey)} className="mt-2 inline-flex items-center gap-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-amber-900 ring-1 ring-amber-200">
                      <Copy className="h-4 w-4" /> {createdKey}
                    </button>
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  {keys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#EFE8DF] bg-white p-4">
                      <div>
                        <div className="font-bold text-[#171411]">{key.name}</div>
                        <div className="font-mono text-xs text-[#8A8178]">{key.masked_key}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(key.status)}`}>{key.status}</span>
                    </div>
                  ))}
                  {keys.length === 0 ? <Empty text="Belum ada API key." /> : null}
                </div>
              </Card>

              <Card title="Entitlement tab ini" icon={<WalletCards className="h-5 w-5" />}>
                {activePlanEntitlement ? (
                  <div className="rounded-2xl bg-[#171411] p-5 text-white">
                    <div className="text-sm text-orange-100/80">{activePlanEntitlement.billing_model === 'pay_per_request' ? 'Pay per request' : 'Paket durasi'}</div>
                    <div className="mt-1 text-2xl font-black">{planLabel(activePlanEntitlement.plan_code)}</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Mini label="Harga" value={planPricing(activePlanEntitlement)} />
                      <Mini label="Fair use" value={activePlanEntitlement.daily_fair_use_limit ? `${activePlanEntitlement.daily_fair_use_limit}/hari` : 'Unlimited'} />
                      <Mini label="Expired" value={formatDate(activePlanEntitlement.expires_at)} />
                    </div>
                  </div>
                ) : (
                  <Empty text="Belum ada entitlement aktif untuk tab ini." />
                )}
              </Card>
            </section>

            <Card title="Request terbaru" icon={<Activity className="h-5 w-5" />}>
              <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {activePlanRequests.map((request) => {
                  const modelLabel = [request.router_provider, request.router_model].filter(Boolean).join(' / ') || '-'
                  return (
                    <div key={request.id} className="rounded-2xl border border-[#EFE8DF] bg-white p-4 transition hover:border-[#F0D8C8] hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#171411] px-2.5 py-1 font-mono text-[11px] font-black text-white" title={request.request_id}>#{shortRequestId(request.request_id)}</span>
                            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#A15A40]">Activity</span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-[#171411]">{request.input_preview || request.service_alias}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${statusClass(request.status)}`}>{request.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#6F675F]">
                        <RequestChip>{request.billing_source}</RequestChip>
                        <RequestChip>{request.amount ? currency.format(request.amount) : '-'}</RequestChip>
                        <RequestChip>{request.router_latency_ms} ms</RequestChip>
                        <RequestChip mono>{modelLabel}</RequestChip>
                      </div>
                    </div>
                  )
                })}
                {activePlanRequests.length === 0 ? <Empty text="Belum ada request untuk tab ini." /> : null}
              </div>
            </Card>
          </div>
        )}
      </section>
    </main>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-[#EFE8DF] bg-white p-4 shadow-sm shadow-orange-950/5 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-base font-black text-[#171411] sm:text-lg">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0EA] text-[#FF5733]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

function RequestChip({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <span className={`max-w-full truncate rounded-full bg-[#FFF7F1] px-2.5 py-1 ring-1 ring-[#F0D8C8] ${mono ? 'font-mono' : ''}`}>{children}</span>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/14 p-4 ring-1 ring-white/18 backdrop-blur">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-orange-50/70">{label}</div>
      <div className="mt-1 truncate text-xl font-black">{value}</div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="text-xs font-semibold text-orange-100/70">{label}</div>
      <div className="mt-1 text-sm font-black">{value}</div>
    </div>
  )
}

function MiniLight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-[#F0D8C8]">
      <div className="text-xs font-black uppercase tracking-[0.12em] text-[#A15A40]">{label}</div>
      <div className="mt-1 text-sm font-black text-[#171411]">{value}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#E7DDD1] bg-[#FBF8F4] p-5 text-sm font-semibold text-[#8A8178]">{text}</div>
}
