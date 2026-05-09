import type { SosmedOrder, SosmedOrderEvent, SosmedRefillAttempt } from '@/types/sosmedOrder'

export type SosmedOrderTimelineStatus = 'done' | 'active' | 'pending' | 'danger'

export type SosmedOrderTimelineItem = {
  key: string
  title: string
  description: string
  timestamp?: string
  status: SosmedOrderTimelineStatus
}

function isTerminalStatus(status?: string) {
  return ['success', 'failed', 'canceled', 'expired'].includes((status || '').toLowerCase())
}

function isFailedStatus(status?: string) {
  return ['failed', 'canceled', 'expired'].includes((status || '').toLowerCase())
}

function eventTime(events: SosmedOrderEvent[], toStatus: string) {
  return events.find((event) => event.to_status === toStatus)?.created_at
}

function latestEventTime(events: SosmedOrderEvent[], statuses: string[]) {
  const allowed = new Set(statuses)
  return [...events].reverse().find((event) => allowed.has(event.to_status))?.created_at
}

function refillDescription(attempt: SosmedRefillAttempt) {
  const status = (attempt.status || '').toLowerCase()
  if (status === 'completed') return 'Refill kamu sudah selesai diproses.'
  if (status === 'failed' || status === 'rejected') return 'Refill belum bisa diproses. Kalau masih bingung, hubungi admin dengan ID order ini.'
  if (status === 'processing') return 'Refill sedang diproses sistem. Kamu bisa cek lagi berkala dari halaman ini.'
  return 'Klaim refill sudah diterima dan masuk antrean proses.'
}

export function shortSosmedOrderID(id: string) {
  return id ? `#${id.slice(0, 8).toUpperCase()}` : '#ORDER'
}

export function formatSosmedTimelineDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function buildSosmedOrderTimeline(order: SosmedOrder, events: SosmedOrderEvent[] = []): SosmedOrderTimelineItem[] {
  const paid = order.payment_status === 'paid'
  const terminal = isTerminalStatus(order.order_status)
  const failed = isFailedStatus(order.order_status)
  const items: SosmedOrderTimelineItem[] = [
    {
      key: 'created',
      title: 'Order dibuat',
      description: 'Order sosmed kamu sudah tercatat di sistem.',
      timestamp: order.created_at,
      status: 'done',
    },
    {
      key: 'paid',
      title: 'Dibayar',
      description: paid ? 'Pembayaran sudah diterima.' : 'Menunggu pembayaran dikonfirmasi.',
      timestamp: order.paid_at || eventTime(events, 'processing'),
      status: paid ? 'done' : failed ? 'danger' : 'active',
    },
  ]

  if (paid) {
    items.push({
      key: 'submitted',
      title: 'Dikirim ke sistem',
      description: 'Order sudah masuk antrean sistem untuk diproses.',
      timestamp: eventTime(events, 'processing') || order.paid_at || order.updated_at,
      status: 'done',
    })
  }

  if (paid && !terminal) {
    items.push({
      key: 'processing',
      title: 'Diproses',
      description: 'Sistem sedang memproses order kamu. Progress bisa berubah otomatis setelah sinkron.',
      timestamp: order.provider_synced_at || eventTime(events, 'processing'),
      status: 'active',
    })
  }

  if ((order.start_count || 0) > 0) {
    items.push({
      key: 'start-count',
      title: 'Start count update',
      description: `Start count terakhir terbaca ${new Intl.NumberFormat('id-ID').format(order.start_count || 0)}.`,
      timestamp: order.provider_synced_at || order.updated_at,
      status: 'done',
    })
  }

  if (order.provider_cancel_status || order.provider_canceled_at) {
    const done = order.provider_cancel_status === 'completed' || order.order_status === 'canceled'
    const danger = order.provider_cancel_status === 'failed'
    items.push({
      key: 'cancel-request',
      title: 'Cancel request',
      description: done
        ? 'Permintaan cancel sudah selesai diproses.'
        : danger
          ? 'Permintaan cancel belum berhasil. Admin bisa bantu cek kalau diperlukan.'
          : 'Permintaan cancel sudah dikirim dan sedang dicek sistem.',
      timestamp: order.provider_canceled_at || latestEventTime(events, ['canceled', 'failed']) || order.updated_at,
      status: danger ? 'danger' : done ? 'done' : 'active',
    })
  }

  for (const attempt of order.refill_history || []) {
    const status = (attempt.status || '').toLowerCase()
    items.push({
      key: `refill-${attempt.attempt_number || attempt.id}`,
      title: `Refill attempt #${attempt.attempt_number || 1}`,
      description: refillDescription(attempt),
      timestamp: attempt.requested_at || attempt.created_at,
      status: status === 'failed' || status === 'rejected' ? 'danger' : status === 'completed' ? 'done' : 'active',
    })
  }

  if (terminal) {
    items.push({
      key: 'final',
      title: order.order_status === 'success' ? 'Selesai' : order.payment_status === 'failed' ? 'Gagal / Refund' : 'Gagal',
      description: order.order_status === 'success'
        ? 'Order sudah selesai. Makasih sudah order di DigiMarket.'
        : order.payment_status === 'failed'
          ? 'Order tidak berhasil dan pembayaran wallet sudah ditandai selesai direfund bila memenuhi syarat.'
          : 'Order tidak berhasil. Kalau pembayaran sudah masuk, sistem/admin akan memastikan saldo aman.',
      timestamp: latestEventTime(events, ['success', 'failed', 'canceled', 'expired']) || order.updated_at,
      status: order.order_status === 'success' ? 'done' : 'danger',
    })
  }

  return items.sort((a, b) => {
    const at = a.timestamp ? new Date(a.timestamp).getTime() : Number.MAX_SAFE_INTEGER
    const bt = b.timestamp ? new Date(b.timestamp).getTime() : Number.MAX_SAFE_INTEGER
    if (Number.isNaN(at) || Number.isNaN(bt)) return 0
    return at - bt
  })
}
