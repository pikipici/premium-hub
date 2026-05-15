"use client"

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Copy, Globe2, KeyRound, Loader2, Plus, RadioTower, WalletCards } from 'lucide-react'

import { digiconnectService } from '@/services/digiconnectService'
import type { DigiConnectApiKey, DigiConnectEntitlement, DigiConnectRequest, DigiConnectSummary } from '@/types/digiconnect'

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
  if (typeof window === 'undefined') return '/v1'
  return `${window.location.origin}/v1`
}

export default function DigiConnectDashboardPage() {
  const [summary, setSummary] = useState<DigiConnectSummary | null>(null)
  const [keys, setKeys] = useState<DigiConnectApiKey[]>([])
  const [requests, setRequests] = useState<DigiConnectRequest[]>([])
  const [entitlements, setEntitlements] = useState<DigiConnectEntitlement[]>([])
  const [newKeyName, setNewKeyName] = useState('Production key')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('/api/v1/digiconnect/requests')

  const activeEntitlement = useMemo(() => entitlements.find((item) => item.status === 'active'), [entitlements])

  const load = async () => {
    setError(null)
    try {
      const [summaryRes, keyRes, requestRes, entitlementRes] = await Promise.all([
        digiconnectService.getSummary(),
        digiconnectService.listApiKeys(),
        digiconnectService.listRequests({ limit: 8 }),
        digiconnectService.listEntitlements(),
      ])
      setSummary(summaryRes.data)
      setKeys(keyRes.data || [])
      setRequests(requestRes.data || [])
      setEntitlements(entitlementRes.data || [])
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

  return (
    <main className="min-h-screen bg-[#F7F4EE] px-4 py-6 text-[#171411] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-[#F0D8C8] bg-[linear-gradient(135deg,#24140D,#B73B20_58%,#FF7048)] p-6 text-white shadow-xl shadow-orange-950/10 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-orange-50 ring-1 ring-white/20">
                <RadioTower className="h-4 w-4" /> DigiConnect API
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Pusat kontrol AI API kamu</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-50/88 sm:text-base">
                Kelola API key, pantau entitlement, dan cek request terbaru sebelum integrasi ke app atau workflow eksternal.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
              <Stat label="Status" value={summary?.status || 'inactive'} />
              <Stat label="API key" value={String(summary?.api_keys_count ?? keys.length)} />
              <Stat label="Plan" value={planLabel(summary?.active_plan_code || activeEntitlement?.plan_code)} />
              <Stat label="Harga" value={planPricing(activeEntitlement)} />
            </div>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center rounded-3xl bg-white py-16 text-[#FF5733]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-6">
              <Card title="OpenAI-compatible Base URL" icon={<Globe2 className="h-5 w-5" />}>
                <div className="rounded-2xl bg-[#FFF7F1] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A15A40]">Base URL untuk 9router</div>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(baseUrl)} className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-[#F0D8C8] bg-white px-3 py-3 text-left font-mono text-xs font-bold text-[#171411] transition hover:border-[#FF5733]">
                    <span className="break-all">{baseUrl}</span>
                    <Copy className="h-4 w-4 shrink-0 text-[#FF5733]" />
                  </button>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-[#7B7067] sm:grid-cols-2">
                    <code className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#F0D8C8]">GET /models</code>
                    <code className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#F0D8C8]">POST /responses</code>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[#7B7067]">Paste base URL ini ke 9router OpenAI Compatible Responses dan pakai API key DigiConnect sebagai bearer token.</p>
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

              <Card title="Entitlement aktif" icon={<WalletCards className="h-5 w-5" />}>
                {activeEntitlement ? (
                  <div className="rounded-2xl bg-[#171411] p-5 text-white">
                    <div className="text-sm text-orange-100/80">{activeEntitlement.billing_model === 'pay_per_request' ? 'Pay per request' : 'Paket durasi'}</div>
                    <div className="mt-1 text-2xl font-black">{planLabel(activeEntitlement.plan_code)}</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Mini label="Harga" value={planPricing(activeEntitlement)} />
                      <Mini label="Fair use" value={activeEntitlement.daily_fair_use_limit ? `${activeEntitlement.daily_fair_use_limit}/hari` : 'Unlimited'} />
                      <Mini label="Expired" value={formatDate(activeEntitlement.expires_at)} />
                    </div>
                  </div>
                ) : (
                  <Empty text="Belum ada entitlement aktif. Pay-per-request mengikuti policy backend." />
                )}
              </Card>
            </section>

            <Card title="Request terbaru" icon={<Activity className="h-5 w-5" />}>
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-[#EFE8DF] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-[#8A8178]">{request.request_id}</div>
                        <div className="mt-1 truncate text-sm font-bold text-[#171411]">{request.input_preview || request.service_alias}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(request.status)}`}>{request.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#6F675F]">
                      <span>{request.billing_source}</span>
                      <span>{request.amount ? currency.format(request.amount) : '-'}</span>
                      <span>{request.router_latency_ms} ms</span>
                    </div>
                  </div>
                ))}
                {requests.length === 0 ? <Empty text="Belum ada request." /> : null}
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
    <section className="rounded-[28px] border border-[#EFE8DF] bg-white p-5 shadow-sm shadow-orange-950/5">
      <div className="mb-4 flex items-center gap-2 text-lg font-black text-[#171411]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0EA] text-[#FF5733]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
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

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#E7DDD1] bg-[#FBF8F4] p-5 text-sm font-semibold text-[#8A8178]">{text}</div>
}
