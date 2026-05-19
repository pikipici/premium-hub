"use client"

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw, ShieldOff } from 'lucide-react'

import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { LOADING_COPY } from '@/lib/copy/loading'
import { formatDateTime } from '@/lib/utils'
import { gmailAdminService } from '@/services/gmailAdminService'
import type { GmailAdminStrikedUser } from '@/types/gmailAdmin'

export default function AdminGmailStrikesPage() {
  const [users, setUsers] = useState<GmailAdminStrikedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reset dialog
  const [target, setTarget] = useState<GmailAdminStrikedUser | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await gmailAdminService.listStrikedUsers()
      setUsers(res.data?.items ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const submitReset = async () => {
    if (!target) return
    setResetLoading(true)
    setResetError('')
    try {
      await gmailAdminService.resetStrikes(target.user_id)
      setTarget(null)
      await fetchAll()
    } catch (e: any) {
      setResetError(e?.response?.data?.message || 'Gagal reset.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <p className="text-sm text-[#6B6B6B]">
          {users.length} user dengan strike aktif (window 30 hari)
        </p>
        <button
          type="button"
          onClick={fetchAll}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-sm hover:bg-[#F7F7F5] disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          className="rounded-2xl border border-[#FFC3B7] bg-[#FFF1ED] px-4 py-3 text-sm text-[#A6260F]"
          role="alert"
        >
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center rounded-3xl border border-[#EBEBEB] bg-white py-16 text-sm text-[#6B6B6B]"
          role="status"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {LOADING_COPY.list}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="Tidak ada user dengan strike"
          hint="Bagus — gak ada user nakal di window 30 hari terakhir."
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[#EBEBEB] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EBEBEB] bg-[#F7F7F5] text-xs uppercase tracking-wide text-[#6B6B6B]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Strikes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Banned Until</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {users.map((u) => {
                const banned = u.banned_until && new Date(u.banned_until) > new Date()
                return (
                  <tr key={u.user_id} className="hover:bg-[#F7F7F5]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#141414]">{u.user_name}</div>
                      <div className="text-xs text-[#6B6B6B]">{u.user_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#B45309]">
                        {u.active_strike_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {banned ? (
                        <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-medium text-[#A6260F]">
                          BANNED
                        </span>
                      ) : (
                        <span className="text-xs text-[#6B6B6B]">aktif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B6B6B]">
                      {u.banned_until ? formatDateTime(u.banned_until) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setTarget(u)
                          setResetError('')
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[#EBEBEB] bg-white px-3 py-1.5 text-xs font-medium text-[#141414] hover:bg-[#F7F7F5]"
                      >
                        <ShieldOff className="h-3 w-3" />
                        Reset
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        onCancel={() => {
          if (resetLoading) return
          setTarget(null)
          setResetError('')
        }}
        onConfirm={submitReset}
        title="Reset Strikes & Ban"
        description={
          target
            ? `Hapus ban + clear semua strikes untuk ${target.user_email}. User langsung bisa request slot lagi.`
            : ''
        }
        confirmLabel={resetLoading ? 'Memproses…' : 'Reset'}
        loading={resetLoading}
        preview={
          resetError ? (
            <div className="text-xs text-[#A6260F]" role="alert">
              {resetError}
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
