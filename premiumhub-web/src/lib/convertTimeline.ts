import type { ConvertOrderDetail, ConvertOrderEvent, ConvertOrderStatus } from '@/types/convert'

export type ConvertStepState = 'done' | 'current' | 'pending' | 'failed'

export interface ConvertTimelineStep {
  key: string
  title: string
  helperText: string
  state: ConvertStepState
}

export interface ConvertStatusSummary {
  label: string
  badgeClassName: string
  headline: string
  description: string
  etaHint: string
  nextActionHint: string
}

const BASE_STEPS: Array<{ key: string; title: string; helperText: string }> = [
  {
    key: 'created',
    title: 'Order dibuat',
    helperText: 'Order convert udah terdaftar dan token tracking udah aktif.',
  },
  {
    key: 'proof',
    title: 'Menunggu bukti transfer',
    helperText: 'Upload bukti transfer biar tim bisa verifikasi pembayaran lu.',
  },
  {
    key: 'review',
    title: 'Verifikasi admin',
    helperText: 'Tim operasional lagi cek validasi bukti dan detail rekening tujuan.',
  },
  {
    key: 'transfer',
    title: 'Proses transfer bank',
    helperText: 'Dana lagi diproses ke rekening tujuan sesuai nominal receive.',
  },
  {
    key: 'done',
    title: 'Selesai',
    helperText: 'Order convert dinyatakan beres dan transfer sukses diteruskan.',
  },
]

function normalizeStatus(status: string): string {
  return String(status || '').trim().toLowerCase()
}

export function isFinalConvertStatus(status: string): boolean {
  const normalized = normalizeStatus(status)
  return normalized === 'success' || normalized === 'failed' || normalized === 'expired' || normalized === 'canceled'
}

function stageIndexFromStatus(status: string): number {
  const normalized = normalizeStatus(status)
  switch (normalized) {
    case 'pending_transfer':
      return 1
    case 'waiting_review':
      return 2
    case 'approved':
    case 'processing':
      return 3
    case 'success':
      return 4
    default:
      return 1
  }
}

function getFailureStageIndex(status: string, events: ConvertOrderEvent[]): number {
  const normalized = normalizeStatus(status)
  if (normalized !== 'failed' && normalized !== 'expired' && normalized !== 'canceled') {
    return -1
  }

  const terminalEvent = [...events]
    .reverse()
    .find((event) => normalizeStatus(event.to_status) === normalized)

  if (terminalEvent?.from_status) {
    return stageIndexFromStatus(terminalEvent.from_status)
  }

  if (normalized === 'expired') return 1
  return 2
}

export function buildConvertTimelineSteps(status: ConvertOrderStatus | string, events: ConvertOrderEvent[]): ConvertTimelineStep[] {
  const normalized = normalizeStatus(status)
  const isFailedState = normalized === 'failed' || normalized === 'expired' || normalized === 'canceled'
  const currentStage = stageIndexFromStatus(normalized)
  const failStage = getFailureStageIndex(normalized, events)

  return BASE_STEPS.map((step, idx) => {
    if (normalized === 'success') {
      return { ...step, state: 'done' }
    }

    if (isFailedState) {
      if (idx < failStage) return { ...step, state: 'done' }
      if (idx === failStage) return { ...step, state: 'failed' }
      return { ...step, state: 'pending' }
    }

    if (idx < currentStage) return { ...step, state: 'done' }
    if (idx === currentStage) return { ...step, state: 'current' }
    return { ...step, state: 'pending' }
  })
}

export function getConvertStatusSummary(status: ConvertOrderStatus | string): ConvertStatusSummary {
  const normalized = normalizeStatus(status)

  switch (normalized) {
    case 'pending_transfer':
      return {
        label: 'Menunggu Transfer',
        badgeClassName: 'bg-amber-100 text-amber-700 border-amber-200',
        headline: 'Transfer dari lu belum terkonfirmasi.',
        description: 'Order udah kebentuk. Langkah berikutnya, upload bukti transfer biar bisa diverifikasi.',
        etaHint: 'Biasanya lanjut cepat setelah bukti masuk.',
        nextActionHint: 'Upload bukti transfer sekarang.',
      }
    case 'waiting_review':
      return {
        label: 'Menunggu Review',
        badgeClassName: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        headline: 'Bukti udah diterima, tim lagi review.',
        description: 'Order lu lagi diverifikasi manual buat pastiin nominal dan tujuan rekening valid.',
        etaHint: 'Umumnya 5-30 menit, tergantung antrean.',
        nextActionHint: 'Tunggu update. Tambah bukti kalau diminta admin.',
      }
    case 'approved':
      return {
        label: 'Approved',
        badgeClassName: 'bg-blue-100 text-blue-700 border-blue-200',
        headline: 'Verifikasi lolos, order siap diproses.',
        description: 'Semua data utama udah valid. Order masuk antrean transfer ke rekening tujuan.',
        etaHint: 'Biasanya lanjut ke processing dalam antrean yang sama.',
        nextActionHint: 'Pantau status, gak perlu aksi tambahan dulu.',
      }
    case 'processing':
      return {
        label: 'Diproses',
        badgeClassName: 'bg-sky-100 text-sky-700 border-sky-200',
        headline: 'Dana lagi ditransfer ke rekening tujuan.',
        description: 'Tim lagi eksekusi proses transfer. Status bakal pindah ke sukses setelah settlement beres.',
        etaHint: 'Biasanya 5-30 menit tergantung channel bank.',
        nextActionHint: 'Tunggu konfirmasi final.',
      }
    case 'success':
      return {
        label: 'Sukses',
        badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        headline: 'Transfer convert berhasil.',
        description: 'Order lu udah selesai. Simpan halaman ini sebagai bukti histori transaksi.',
        etaHint: 'Final.',
        nextActionHint: 'Kalau dana belum masuk, kontak support dengan order ID.',
      }
    case 'failed':
      return {
        label: 'Gagal',
        badgeClassName: 'bg-red-100 text-red-700 border-red-200',
        headline: 'Order convert gagal diproses.',
        description: 'Ada kondisi yang bikin proses berhenti sebelum selesai.',
        etaHint: 'Final.',
        nextActionHint: 'Cek reason terbaru di log, lalu hubungi support kalau perlu.',
      }
    case 'expired':
      return {
        label: 'Expired',
        badgeClassName: 'bg-gray-100 text-gray-700 border-gray-200',
        headline: 'Order kedaluwarsa sebelum selesai.',
        description: 'Batas waktu order udah lewat, jadi proses ditutup otomatis.',
        etaHint: 'Final.',
        nextActionHint: 'Buat order baru kalau masih mau lanjut convert.',
      }
    case 'canceled':
      return {
        label: 'Dibatalkan',
        badgeClassName: 'bg-gray-100 text-gray-700 border-gray-200',
        headline: 'Order dibatalkan.',
        description: 'Order ini udah ditutup dan gak akan diproses lagi.',
        etaHint: 'Final.',
        nextActionHint: 'Buat order baru kalau perlu transaksi ulang.',
      }
    default:
      return {
        label: status,
        badgeClassName: 'bg-gray-100 text-gray-700 border-gray-200',
        headline: 'Status order lagi diproses.',
        description: 'Pantau update terbaru di timeline.',
        etaHint: 'Menyesuaikan antrean.',
        nextActionHint: 'Refresh berkala untuk lihat update terbaru.',
      }
  }
}

export function getFriendlyStatusLabel(status: string): string {
  const normalized = normalizeStatus(status)
  switch (normalized) {
    case 'pending_transfer':
      return 'Menunggu bukti transfer'
    case 'waiting_review':
      return 'Menunggu verifikasi admin'
    case 'approved':
      return 'Verifikasi lolos (approved)'
    case 'processing':
      return 'Sedang diproses transfer'
    case 'success':
      return 'Transfer sukses'
    case 'failed':
      return 'Order gagal'
    case 'expired':
      return 'Order expired'
    case 'canceled':
      return 'Order dibatalkan'
    case '':
      return 'Order dibuat'
    default:
      return normalized
  }
}

export function getEventHeadline(event: ConvertOrderEvent): string {
  const from = getFriendlyStatusLabel(event.from_status)
  const to = getFriendlyStatusLabel(event.to_status)

  if (!event.from_status) return to
  return `${from} → ${to}`
}

export function getLatestEventReason(events: ConvertOrderEvent[], currentStatus: string): string {
  const normalized = normalizeStatus(currentStatus)
  const latest = [...events]
    .reverse()
    .find((event) => normalizeStatus(event.to_status) === normalized && event.reason?.trim())

  return latest?.reason?.trim() || ''
}

export function getLastUpdatedAt(detail: ConvertOrderDetail): string {
  const lastEvent = [...detail.events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).pop()
  return lastEvent?.created_at || detail.order.updated_at || detail.order.created_at
}
