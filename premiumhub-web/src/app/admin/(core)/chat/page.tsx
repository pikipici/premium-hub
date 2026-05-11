"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCheck,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  RefreshCcw,
  Search,
  Send,
  WifiOff,
} from 'lucide-react'

import { ChatSocket } from '@/lib/chatSocket'
import { chatService } from '@/services/chatService'
import type {
  ChatInboxItem,
  ChatMessage,
  ChatStatus,
  ChatWsEnvelope,
} from '@/types/chat'

type ConnState = 'connecting' | 'open' | 'closed'
type InboxFilter = 'unread' | 'open' | 'closed' | 'all'

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dividerLabel(value: string) {
  const d = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(d, today)) return 'Hari ini'
  if (isSameDay(d, yesterday)) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function mapErr(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}

export default function AdminChatPage() {
  const [inbox, setInbox] = useState<ChatInboxItem[]>([])
  const [inboxLoading, setInboxLoading] = useState(true)
  const [inboxError, setInboxError] = useState('')
  const [filter, setFilter] = useState<InboxFilter>('open')
  const [search, setSearch] = useState('')
  const [unreadTotal, setUnreadTotal] = useState(0)

  const [selectedID, setSelectedID] = useState<string | null>(null)
  const [selectedMeta, setSelectedMeta] = useState<ChatInboxItem | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState('')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [connState, setConnState] = useState<ConnState>('connecting')

  const listRef = useRef<HTMLDivElement | null>(null)
  const atBottomRef = useRef(true)
  const socketRef = useRef<ChatSocket | null>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const loadInbox = useCallback(async () => {
    setInboxLoading(true)
    setInboxError('')
    try {
      const res = await chatService.adminInbox({
        status: filter,
        q: search.trim() || undefined,
        page: 1,
        limit: 50,
      })
      if (!res.success) {
        setInboxError(res.message || 'Gagal memuat inbox')
        return
      }
      setInbox(res.data.conversations || [])
      setUnreadTotal(res.data.unread_conv_ct || 0)
    } catch (err) {
      setInboxError(mapErr(err, 'Gagal memuat inbox'))
    } finally {
      setInboxLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const loadMessages = useCallback(
    async (convID: string, opts: { markRead?: boolean } = {}) => {
      setMsgLoading(true)
      setMsgError('')
      try {
        const res = await chatService.adminMessages(convID, { limit: 100 })
        if (!res.success) {
          setMsgError(res.message || 'Gagal memuat pesan')
          return
        }
        setMessages(res.data.messages || [])
        setSelectedMeta((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            status: res.data.conversation.status,
            last_message_at: res.data.conversation.last_message_at,
            last_message_preview: res.data.conversation.last_message_preview,
            unread_for_admin: res.data.conversation.unread_for_admin,
            unread_for_user: res.data.conversation.unread_for_user,
          }
        })
        if (opts.markRead) {
          try {
            await chatService.adminMarkRead(convID)
          } catch {
            // ignore
          }
          setInbox((prev) =>
            prev.map((c) => (c.id === convID ? { ...c, unread_for_admin: 0 } : c))
          )
        }
        setTimeout(() => scrollToBottom(), 0)
      } catch (err) {
        setMsgError(mapErr(err, 'Gagal memuat pesan'))
      } finally {
        setMsgLoading(false)
      }
    },
    [scrollToBottom]
  )

  const selectConversation = useCallback(
    (conv: ChatInboxItem) => {
      setSelectedID(conv.id)
      setSelectedMeta(conv)
      setMessages([])
      void loadMessages(conv.id, { markRead: true })
    },
    [loadMessages]
  )

  // WebSocket admin
  useEffect(() => {
    const sock = new ChatSocket({
      role: 'admin',
      onStatusChange: setConnState,
      onEnvelope: (env: ChatWsEnvelope) => {
        if (env.type === 'message') {
          const msg = env.payload
          // update inbox preview + unread
          setInbox((prev) => {
            const idx = prev.findIndex((c) => c.id === env.conversation_id)
            if (idx === -1) {
              // conversation baru -> trigger refetch ringan
              void loadInbox()
              return prev
            }
            const existing = prev[idx]
            const preview = msg.body.length > 200 ? msg.body.slice(0, 200) : msg.body
            const updated: ChatInboxItem = {
              ...existing,
              last_message_at: msg.created_at,
              last_message_preview: preview,
              status: 'open',
              unread_for_admin:
                msg.sender_role === 'user' && env.conversation_id !== selectedID
                  ? existing.unread_for_admin + 1
                  : existing.unread_for_admin,
            }
            const rest = prev.filter((c) => c.id !== env.conversation_id)
            return [updated, ...rest]
          })
          if (msg.sender_role === 'user') {
            setUnreadTotal((prev) => (env.conversation_id === selectedID ? prev : prev + 1))
          }
          // kalau lagi buka conversation yg sama -> append message list
          if (env.conversation_id === selectedID) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            if (atBottomRef.current) {
              setTimeout(() => scrollToBottom(true), 0)
            }
            // otomatis mark-read karena admin memang lagi liat
            if (msg.sender_role === 'user') {
              void chatService.adminMarkRead(selectedID).catch(() => undefined)
            }
          }
        } else if (env.type === 'status') {
          setInbox((prev) =>
            prev.map((c) =>
              c.id === env.conversation_id ? { ...c, status: env.payload.status } : c
            )
          )
          if (env.conversation_id === selectedID) {
            setSelectedMeta((prev) =>
              prev ? { ...prev, status: env.payload.status } : prev
            )
          }
        }
      },
    })
    socketRef.current = sock
    sock.connect()
    return () => sock.close()
  }, [loadInbox, scrollToBottom, selectedID])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) < 40
  }, [])

  const submit = useCallback(async () => {
    if (!selectedID) return
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await chatService.adminSend(selectedID, body)
      if (!res.success) {
        setMsgError(res.message || 'Gagal kirim pesan')
        return
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev
        return [...prev, res.data]
      })
      setDraft('')
      atBottomRef.current = true
      setTimeout(() => scrollToBottom(true), 0)
    } catch (err) {
      setMsgError(mapErr(err, 'Gagal kirim pesan'))
    } finally {
      setSending(false)
    }
  }, [draft, selectedID, sending, scrollToBottom])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit()
      }
    },
    [submit]
  )

  const toggleStatus = useCallback(async () => {
    if (!selectedID || !selectedMeta) return
    const next: ChatStatus = selectedMeta.status === 'open' ? 'closed' : 'open'
    try {
      const res = await chatService.adminSetStatus(selectedID, next)
      if (!res.success) {
        setMsgError(res.message || 'Gagal ubah status')
        return
      }
      setSelectedMeta({ ...selectedMeta, status: next })
      setInbox((prev) => prev.map((c) => (c.id === selectedID ? { ...c, status: next } : c)))
    } catch (err) {
      setMsgError(mapErr(err, 'Gagal ubah status'))
    }
  }, [selectedID, selectedMeta])

  const grouped = useMemo(() => {
    const out: Array<{ divider: string } | { msg: ChatMessage }> = []
    let lastKey = ''
    for (const m of messages) {
      const d = new Date(m.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (key !== lastKey) {
        out.push({ divider: dividerLabel(m.created_at) })
        lastKey = key
      }
      out.push({ msg: m })
    }
    return out
  }, [messages])

  const statusBadge = () => {
    if (connState === 'open') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#16774C]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16774C]" />
          Live
        </span>
      )
    }
    if (connState === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3EC] px-2 py-0.5 text-[11px] font-semibold text-[#C85C2C]">
          <Loader2 className="h-3 w-3 animate-spin" /> Menyambung
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F3F1] px-2 py-0.5 text-[11px] font-semibold text-[#555]">
        <WifiOff className="h-3 w-3" /> Offline
      </span>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
      {/* Inbox panel */}
      <section className="flex h-[calc(100vh-160px)] min-h-[480px] flex-col rounded-2xl border border-[#EBEBEB] bg-white">
        <div className="border-b border-[#EBEBEB] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#141414]" />
              <h2 className="text-sm font-extrabold text-[#141414]">Inbox Chat</h2>
              {statusBadge()}
            </div>
            <button
              type="button"
              onClick={() => void loadInbox()}
              className="rounded-lg border border-[#E2E2E2] p-1.5 text-[#555] hover:bg-[#F7F7F5]"
              title="Refresh"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[#888]">
            {unreadTotal} thread belum dibaca
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(['unread', 'open', 'closed', 'all'] as InboxFilter[]).map((f) => {
              const count = f === 'unread' ? unreadTotal : 0
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    filter === f
                      ? 'border-[#141414] bg-[#141414] text-white'
                      : 'border-[#E5E5E3] bg-white text-[#666] hover:bg-[#F7F7F5]'
                  }`}
                >
                  {f === 'unread'
                    ? 'Unread'
                    : f === 'open'
                      ? 'Open'
                      : f === 'closed'
                        ? 'Closed'
                        : 'Semua'}
                  {f === 'unread' && count > 0 ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        filter === f ? 'bg-white text-[#141414]' : 'bg-[#E0592A] text-white'
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#E2E2E2] bg-white px-2">
            <Search className="h-3.5 w-3.5 text-[#888]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama/email user..."
              className="w-full border-0 bg-transparent py-1.5 text-xs text-[#222] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {inboxLoading ? (
            <div className="flex h-32 items-center justify-center text-xs text-[#888]">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Memuat...
            </div>
          ) : inboxError ? (
            <div className="p-4 text-xs font-semibold text-red-700">{inboxError}</div>
          ) : inbox.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#888]">Belum ada percakapan.</div>
          ) : (
            <ul className="divide-y divide-[#F0F0EE]">
              {inbox.map((conv) => {
                const active = conv.id === selectedID
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conv)}
                      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-[#F5F5F3]' : 'hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#141414] text-[11px] font-bold uppercase text-white">
                        {(conv.user_name || conv.user_email || '?').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-bold text-[#141414]">
                            {conv.user_name || conv.user_email || '(tanpa nama)'}
                          </p>
                          <span className="shrink-0 text-[10px] text-[#999]">
                            {formatDateTime(conv.last_message_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-[#666]">
                          {conv.last_message_preview || '— Belum ada pesan'}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                              conv.status === 'open'
                                ? 'bg-[#ECFDF3] text-[#16774C]'
                                : 'bg-[#F3F3F1] text-[#666]'
                            }`}
                          >
                            {conv.status}
                          </span>
                          {conv.unread_for_admin > 0 ? (
                            <span className="rounded-full bg-[#E0592A] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {conv.unread_for_admin}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Detail panel */}
      <section className="flex h-[calc(100vh-160px)] min-h-[480px] flex-col rounded-2xl border border-[#EBEBEB] bg-white">
        {!selectedID || !selectedMeta ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[#888]">
            Pilih percakapan dari inbox di kiri untuk mulai balas.
          </div>
        ) : (
          <>
            <div className="border-b border-[#EBEBEB] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#141414]">
                    {selectedMeta.user_name || selectedMeta.user_email || '(tanpa nama)'}
                  </p>
                  <p className="text-xs text-[#666]">{selectedMeta.user_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      selectedMeta.status === 'open'
                        ? 'bg-[#ECFDF3] text-[#16774C]'
                        : 'bg-[#F3F3F1] text-[#666]'
                    }`}
                  >
                    {selectedMeta.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleStatus()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E2E2] px-2.5 py-1.5 text-[11px] font-semibold text-[#555] hover:bg-[#F7F7F5]"
                  >
                    {selectedMeta.status === 'open' ? (
                      <>
                        <Lock className="h-3 w-3" /> Tutup
                      </>
                    ) : (
                      <>
                        <LockOpen className="h-3 w-3" /> Buka kembali
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={listRef}
              onScroll={onScroll}
              className="flex-1 space-y-2 overflow-y-auto p-4 sm:p-6"
            >
              {msgLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-[#888]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-center text-sm text-[#888]">
                  Belum ada pesan di conversation ini.
                </div>
              ) : (
                grouped.map((item, idx) => {
                  if ('divider' in item) {
                    return (
                      <div key={`d-${idx}`} className="flex items-center justify-center py-1">
                        <span className="rounded-full bg-[#F3F3F1] px-3 py-0.5 text-[11px] font-semibold text-[#888]">
                          {item.divider}
                        </span>
                      </div>
                    )
                  }
                  const m = item.msg
                  const mine = m.sender_role === 'admin'
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          mine
                            ? 'rounded-tr-sm bg-[#141414] text-white'
                            : 'rounded-tl-sm border border-[#EBEBEB] bg-[#FAFAF8] text-[#222]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            mine ? 'text-white/70' : 'text-[#999]'
                          }`}
                        >
                          {formatTime(m.created_at)}
                          {mine ? (
                            <CheckCheck
                              className={`h-3 w-3 ${
                                m.read_by_user ? 'text-[#4FC3F7]' : 'text-white/50'
                              }`}
                            />
                          ) : null}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {msgError ? (
              <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
                {msgError}
              </div>
            ) : null}

            <div className="border-t border-[#EBEBEB] p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ketik balasan buat user, Enter buat kirim"
                  rows={2}
                  disabled={selectedMeta.status === 'closed'}
                  className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-[#E2E2E2] bg-white px-3 py-2 text-sm text-[#222] focus:border-[#141414] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F7F7F5]"
                />
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim() || sending || selectedMeta.status === 'closed'}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#141414] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Kirim
                </button>
              </div>
              {selectedMeta.status === 'closed' ? (
                <p className="mt-2 text-xs text-[#888]">
                  Chat ditutup. Buka kembali untuk balas.
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
