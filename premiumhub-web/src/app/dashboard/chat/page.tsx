"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCheck, Loader2, RefreshCcw, Send, WifiOff } from 'lucide-react'

import { ChatSocket } from '@/lib/chatSocket'
import { chatService } from '@/services/chatService'
import type {
  ChatConversation,
  ChatMessage,
  ChatWsEnvelope,
} from '@/types/chat'

type ConnState = 'connecting' | 'open' | 'closed'

function formatTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dateDividerLabel(value: string) {
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

export default function DashboardChatPage() {
  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [connState, setConnState] = useState<ConnState>('connecting')

  const listRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<ChatSocket | null>(null)
  const atBottomRef = useRef(true)

  // scroll selalu ke bawah kalau user belum scroll manual ke atas
  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await chatService.myConversation({ limit: 80 })
      if (!res.success) {
        setError(res.message || 'Gagal memuat chat')
        return
      }
      setConversation(res.data.conversation)
      setMessages(res.data.messages || [])
      // optimis: mark read begitu halaman dibuka
      try {
        await chatService.markUserRead()
      } catch {
        // ignore
      }
    } catch (err) {
      setError(mapErr(err, 'Gagal memuat chat'))
    } finally {
      setLoading(false)
      setTimeout(() => scrollToBottom(), 0)
    }
  }, [scrollToBottom])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  // WebSocket lifecycle
  useEffect(() => {
    const sock = new ChatSocket({
      role: 'user',
      onStatusChange: setConnState,
      onEnvelope: (env: ChatWsEnvelope) => {
        if (env.type === 'message') {
          const msg = env.payload
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // kalau admin yg nulis & user lg di halaman ini → tandain read
          if (msg.sender_role === 'admin') {
            void chatService.markUserRead().catch(() => undefined)
          }
          if (atBottomRef.current) {
            setTimeout(() => scrollToBottom(true), 0)
          }
        }
      },
    })
    socketRef.current = sock
    sock.connect()
    return () => sock.close()
  }, [scrollToBottom])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const threshold = 40
    atBottomRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) < threshold
  }, [])

  const submit = useCallback(async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const res = await chatService.sendAsUser(body)
      if (!res.success) {
        setError(res.message || 'Gagal kirim pesan')
        return
      }
      // hub juga bakal broadcast ke user sendiri; tapi supaya UI instan, append
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.id)) return prev
        return [...prev, res.data]
      })
      setDraft('')
      atBottomRef.current = true
      setTimeout(() => scrollToBottom(true), 0)
    } catch (err) {
      setError(mapErr(err, 'Gagal kirim pesan'))
    } finally {
      setSending(false)
    }
  }, [draft, sending, scrollToBottom])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit()
      }
    },
    [submit]
  )

  const grouped = useMemo(() => {
    const out: Array<{ divider: string } | { msg: ChatMessage }> = []
    let lastDate = ''
    for (const m of messages) {
      const d = new Date(m.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (key !== lastDate) {
        out.push({ divider: dateDividerLabel(m.created_at) })
        lastDate = key
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
          <Loader2 className="h-3 w-3 animate-spin" /> Menyambung...
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
    <div className="flex min-h-[calc(100vh-200px)] flex-col gap-4">
      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#141414]">Chat Support</h1>
              {statusBadge()}
            </div>
            <p className="mt-1 text-sm text-[#888]">
              Kirim pesan langsung ke admin. Balasan bakal muncul di sini secara realtime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInitial()}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#E2E2E2] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </section>

      <section className="flex flex-1 flex-col rounded-2xl border border-[#EBEBEB] bg-white">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6"
          style={{ minHeight: 320, maxHeight: 'calc(100vh - 360px)' }}
        >
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#888]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm text-[#888]">
              Belum ada percakapan. Tulis pesan lu di bawah biar admin bisa bantu.
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
              const mine = m.sender_role === 'user'
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
                            m.read_by_admin ? 'text-[#4FC3F7]' : 'text-white/50'
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

        {error ? (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="border-t border-[#EBEBEB] p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tulis pesan lu, Enter buat kirim (Shift+Enter newline)"
              rows={2}
              disabled={conversation?.status === 'closed'}
              className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-[#E2E2E2] bg-white px-3 py-2 text-sm text-[#222] focus:border-[#141414] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#F7F7F5]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim() || sending}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#141414] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Kirim
            </button>
          </div>
          {conversation?.status === 'closed' ? (
            <p className="mt-2 text-xs text-[#888]">
              Chat ditutup oleh admin. Kirim pesan baru untuk buka kembali.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
