"use client"

import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivitySquare, Cpu, Loader2, ReceiptText, Router, WalletCards } from 'lucide-react'

import { ADMIN_PAGE_LIMIT } from '@/config/pagination'
import { digiconnectService } from '@/services/digiconnectService'
import type { DigiConnectAdminOverview, DigiConnectEntitlement, DigiConnectRequest } from '@/types/digiconnect'

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (['completed', 'active', 'charged', 'included'].includes(normalized)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (['processing', 'pending_verification'].includes(normalized)) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-rose-50 text-rose-700 ring-rose-200'
}

export default function AdminDigiConnectPage() {
  const [overview, setOverview] = useState<DigiConnectAdminOverview | null>(null)
  const [requests, setRequests] = useState<DigiConnectRequest[]>([])
  const [entitlements, setEntitlements] = useState<DigiConnectEntitlement[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [provisionForm, setProvisionForm] = useState({ userId: '', planCode: 'digiconnect_starter', price: '0', durationDays: '30', dailyFairUseLimit: '0', payPerRequestEnabled: true, overagePayPerRequestEnabled: true })
  const [provisioning, setProvisioning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalRequests = useMemo(
    () => Object.values(overview?.status_counts || {}).reduce((sum, item) => sum + item, 0),
    [overview]
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [overviewRes, requestRes, entitlementRes] = await Promise.all([
        digiconnectService.adminOverview(),
        digiconnectService.adminListRequests({ limit: ADMIN_PAGE_LIMIT, status: statusFilter || undefined }),
        digiconnectService.adminListEntitlements({ limit: 8 }),
      ])
      setOverview(overviewRes.data)
      setRequests(requestRes.data || [])
      setEntitlements(entitlementRes.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat admin DigiConnect')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const provisionEntitlement = async () => {
    setProvisioning(true)
    setError(null)
    try {
      await digiconnectService.adminProvisionEntitlement({
        user_id: provisionForm.userId.trim(),
        plan_code: provisionForm.planCode.trim() || 'digiconnect_starter',
        billing_model: 'manual_admin',
        price: Number(provisionForm.price) || 0,
        duration_days: Number(provisionForm.durationDays) || 30,
        daily_fair_use_limit: Number(provisionForm.dailyFairUseLimit) || 0,
        pay_per_request_enabled: provisionForm.payPerRequestEnabled,
        overage_pay_per_request_enabled: provisionForm.overagePayPerRequestEnabled,
      })
      setProvisionForm((prev) => ({ ...prev, userId: '' }))
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat entitlement')
    } finally {
      setProvisioning(false)
    }
  }

  const routerConfigured = Boolean(overview?.router?.router_configured)

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#18130F,#7F2B18_52%,#FF623C)] p-6 text-white shadow-xl shadow-orange-950/10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ring-1 ring-white/18">
              <Cpu className="h-4 w-4" /> Operator Console
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">DigiConnect Control Room</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-50/85">
              Pantau trafik API, billing wallet, request pending verification, dan entitlement pelanggan dari satu layar admin.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 xl:min-w-[640px]">
            <Stat label="Total request" value={String(totalRequests)} />
            <Stat label="Hari ini" value={String(Object.values(overview?.today_counts || {}).reduce((sum, item) => sum + item, 0))} />
            <Stat label="Tertagih" value={currency.format(overview?.charged_amount || 0)} />
            <Stat label="Router" value={routerConfigured ? 'Siap' : 'Belum'} />
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl bg-white py-16 text-[#FF5733]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-[28px] border border-[#EFE8DF] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-lg font-black text-[#171411]">
                <ActivitySquare className="h-5 w-5 text-[#FF5733]" /> Request terbaru
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-[#E7DDD1] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]"
              >
                <option value="">Semua status</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending_verification">Pending verification</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-[#9A9289]">
                  <tr>
                    <th className="px-3 py-3">Request</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Billing</th>
                    <th className="px-3 py-3">Router</th>
                    <th className="px-3 py-3">Dibuat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1E8DF]">
                  {requests.map((request) => (
                    <tr key={request.id} className="align-top">
                      <td className="px-3 py-4">
                        <div className="font-mono text-xs text-[#8A8178]">{request.request_id}</div>
                        <div className="mt-1 max-w-[320px] truncate font-bold text-[#171411]">{request.input_preview || request.service_alias}</div>
                      </td>
                      <td className="px-3 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(request.status)}`}>{request.status}</span></td>
                      <td className="px-3 py-4 text-[#665D54]">{request.billing_source}<br />{request.amount ? currency.format(request.amount) : '-'}</td>
                      <td className="px-3 py-4 text-[#665D54]">{request.router_status || '-'}<br />{request.router_latency_ms} ms</td>
                      <td className="px-3 py-4 text-[#665D54]">{formatDate(request.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {requests.length === 0 ? <Empty text="Belum ada request sesuai filter." /> : null}
            </div>
          </section>

          <aside className="space-y-6">
            <Panel title="Router" icon={<Router className="h-5 w-5" />}>
              <div className="rounded-2xl bg-[#171411] p-4 text-white">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-orange-100/70">Status</div>
                <div className="mt-1 text-2xl font-black">{routerConfigured ? 'Configured' : 'Not configured'}</div>
                <div className="mt-3 text-xs text-orange-100/70">Checked: {formatDate(String(overview?.router?.checked_at || ''))}</div>
              </div>
            </Panel>

            <Panel title="Provision entitlement" icon={<WalletCards className="h-5 w-5" />}>
              <div className="space-y-3">
                <input
                  value={provisionForm.userId}
                  onChange={(event) => setProvisionForm((prev) => ({ ...prev, userId: event.target.value }))}
                  className="w-full rounded-xl border border-[#E7DDD1] px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]"
                  placeholder="User UUID"
                />
                <input
                  value={provisionForm.planCode}
                  onChange={(event) => setProvisionForm((prev) => ({ ...prev, planCode: event.target.value }))}
                  className="w-full rounded-xl border border-[#E7DDD1] px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]"
                  placeholder="Plan code"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input value={provisionForm.price} onChange={(event) => setProvisionForm((prev) => ({ ...prev, price: event.target.value }))} className="rounded-xl border border-[#E7DDD1] px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]" placeholder="Harga" />
                  <input value={provisionForm.durationDays} onChange={(event) => setProvisionForm((prev) => ({ ...prev, durationDays: event.target.value }))} className="rounded-xl border border-[#E7DDD1] px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]" placeholder="Hari" />
                  <input value={provisionForm.dailyFairUseLimit} onChange={(event) => setProvisionForm((prev) => ({ ...prev, dailyFairUseLimit: event.target.value }))} className="rounded-xl border border-[#E7DDD1] px-3 py-2 text-sm font-semibold outline-none focus:border-[#FF5733]" placeholder="Fair use" />
                </div>
                <div className="grid gap-2 text-xs font-bold text-[#6F675F]">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={provisionForm.payPerRequestEnabled} onChange={(event) => setProvisionForm((prev) => ({ ...prev, payPerRequestEnabled: event.target.checked }))} /> Pay per request</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={provisionForm.overagePayPerRequestEnabled} onChange={(event) => setProvisionForm((prev) => ({ ...prev, overagePayPerRequestEnabled: event.target.checked }))} /> Overage pay per request</label>
                </div>
                <button type="button" onClick={provisionEntitlement} disabled={provisioning || !provisionForm.userId.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 disabled:opacity-60">
                  {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aktifkan entitlement
                </button>
              </div>
            </Panel>

            <Panel title="Entitlement terbaru" icon={<WalletCards className="h-5 w-5" />}>
              <div className="space-y-3">
                {entitlements.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#EFE8DF] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-[#171411]">{item.plan_code}</div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#6F675F]">
                      <span>{currency.format(item.price)}</span>
                      <span>{item.pay_per_request_enabled ? 'PPR aktif' : 'PPR off'}</span>
                      <span className="col-span-2">Expire: {formatDate(item.expires_at)}</span>
                    </div>
                  </div>
                ))}
                {entitlements.length === 0 ? <Empty text="Belum ada entitlement." /> : null}
              </div>
            </Panel>

            <Panel title="Billing hari ini" icon={<ReceiptText className="h-5 w-5" />}>
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Charge" value={String(overview?.charged_count || 0)} />
                <Mini label="Amount" value={currency.format(overview?.charged_amount || 0)} />
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/14 p-4 ring-1 ring-white/18 backdrop-blur">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-orange-50/70">{label}</div>
      <div className="mt-1 truncate text-lg font-black">{value}</div>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#EFE8DF] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-lg font-black text-[#171411]">
        <span className="text-[#FF5733]">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FFF6F0] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#A36B55]">{label}</div>
      <div className="mt-1 text-lg font-black text-[#171411]">{value}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#E7DDD1] bg-[#FBF8F4] p-5 text-sm font-semibold text-[#8A8178]">{text}</div>
}
