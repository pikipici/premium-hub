import type { ChatWsEnvelope } from '@/types/chat'

export type ChatSocketRole = 'user' | 'admin'

export interface ChatSocketOptions {
  role: ChatSocketRole
  onEnvelope: (env: ChatWsEnvelope) => void
  onStatusChange?: (status: 'connecting' | 'open' | 'closed') => void
}

/**
 * Resolve URL WebSocket dari NEXT_PUBLIC_API_URL. Fallback ke same-origin `/api/v1`.
 * Hasil akhir misal: ws://localhost:8081/api/v1/chat/ws atau wss://.../api/v1/admin/chat/ws
 */
function resolveWsUrl(role: ChatSocketRole) {
  const suffix = role === 'admin' ? '/admin/chat/ws' : '/chat/ws'

  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim()

  if (raw) {
    try {
      const u = new URL(raw)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      // path env sudah termasuk /api/v1 biasanya, langsung tempel suffix
      u.pathname = u.pathname.replace(/\/$/, '') + suffix
      return u.toString()
    } catch {
      // fallthrough ke same-origin
    }
  }

  if (typeof window === 'undefined') {
    // SSR: gak kepake, dipanggil hanya dari client component.
    return ''
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/v1${suffix}`
}

/**
 * ChatSocket: tipis di atas WebSocket native, handle auto-reconnect dengan
 * exponential backoff + state machine sederhana. Cookie auth otomatis dikirim
 * browser karena handshake pake same-origin / CORS-allowed origin.
 */
export class ChatSocket {
  private ws: WebSocket | null = null
  private closed = false
  private retry = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly opts: ChatSocketOptions) {}

  connect() {
    this.closed = false
    this.open()
  }

  close() {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    this.opts.onStatusChange?.('closed')
  }

  private open() {
    const url = resolveWsUrl(this.opts.role)
    if (!url) return

    this.opts.onStatusChange?.('connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      console.warn('[chat-ws] construct failed:', err)
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.retry = 0
      this.opts.onStatusChange?.('open')
    }

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      try {
        const env = JSON.parse(ev.data) as ChatWsEnvelope
        this.opts.onEnvelope(env)
      } catch (err) {
        console.warn('[chat-ws] invalid payload:', err)
      }
    }

    ws.onerror = () => {
      // onclose akan kepanggil setelah ini; jangan reconnect dua kali
    }

    ws.onclose = () => {
      this.ws = null
      this.opts.onStatusChange?.('closed')
      if (!this.closed) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect() {
    if (this.closed) return
    // backoff: 1s, 2s, 4s, 8s, cap di 20s
    const delay = Math.min(1000 * 2 ** this.retry, 20_000)
    this.retry += 1
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }
}
