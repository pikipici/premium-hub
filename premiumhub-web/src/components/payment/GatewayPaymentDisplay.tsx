"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, createScope } from 'animejs'
import { Building2, Copy, Download, ExternalLink, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

type GatewayPaymentDisplayProps = {
  paymentMethod?: string
  paymentNumber?: string
  paymentUrl?: string
  appUrl?: string
  className?: string
}

type QRState = {
  source: string
  dataUrl: string
  error: string
}

const qrisMethods = new Set(['SP', 'QRIS', 'NQ', 'GQ', 'SQ'])
const vaMethods = new Set([
  'BC',
  'M2',
  'VA',
  'I1',
  'B1',
  'BT',
  'A1',
  'AG',
  'NC',
  'BR',
  'S1',
  'DM',
  'BV',
  'BRI_VA',
  'BNI_VA',
  'PERMATA_VA',
  'MAYBANK_VA',
  'CIMB_NIAGA_VA',
  'BNC_VA',
  'SAMPOERNA_VA',
  'ATM_BERSAMA_VA',
  'ARTHA_GRAHA_VA',
])

const methodAliases: Record<string, string> = {
  QRIS: 'SP',
  QR: 'SP',
  BRI_VA: 'BR',
  BRIVA: 'BR',
  BNI_VA: 'I1',
  PERMATA_VA: 'BT',
  BCA_VA: 'BC',
  MANDIRI_VA: 'M2',
  CIMB_NIAGA_VA: 'B1',
  BNC_VA: 'NC',
  BSI_VA: 'BV',
  MAYBANK_VA: 'VA',
  SAMPOERNA_VA: 'S1',
  ATM_BERSAMA_VA: 'A1',
  ARTHA_GRAHA_VA: 'AG',
}

const methodLabels: Record<string, string> = {
  SP: 'QRIS',
  NQ: 'QRIS Nobu',
  GQ: 'QRIS Gudang Voucher',
  SQ: 'QRIS ShopeePay',
  BR: 'BRI Virtual Account',
  I1: 'BNI Virtual Account',
  BT: 'Permata Virtual Account',
  BC: 'BCA Virtual Account',
  M2: 'Mandiri Virtual Account',
  VA: 'Maybank Virtual Account',
  B1: 'CIMB Niaga Virtual Account',
  NC: 'BNC Virtual Account',
  BV: 'BSI Virtual Account',
  A1: 'ATM Bersama',
  AG: 'Artha Graha Virtual Account',
}

const normalizeMethod = (value?: string) => {
  const raw = (value || '').trim().toUpperCase().replace(/[-\s]+/g, '_')
  return methodAliases[raw] || raw
}

const methodLabel = (value?: string) => {
  const method = normalizeMethod(value)
  return methodLabels[method] || (method ? method.replace(/_/g, ' ') : 'Payment Number')
}

const isHttpURL = (value: string) => /^https?:\/\//i.test(value.trim())

export default function GatewayPaymentDisplay({ paymentMethod, paymentNumber, paymentUrl, appUrl, className }: GatewayPaymentDisplayProps) {
  const paymentRootRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrState, setQrState] = useState<QRState>({ source: '', dataUrl: '', error: '' })

  const normalizedMethod = useMemo(() => normalizeMethod(paymentMethod), [paymentMethod])
  const isQris = qrisMethods.has(normalizedMethod)
  const isVA = vaMethods.has(normalizedMethod)
  const value = (paymentNumber || '').trim()
  const actionUrl = (appUrl || paymentUrl || (isHttpURL(value) ? value : '')).trim()

  useEffect(() => {
    if (!isQris || !value) return

    let canceled = false

    QRCode.toDataURL(value, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!canceled) {
          setQrState({ source: value, dataUrl: url, error: '' })
        }
      })
      .catch(() => {
        if (!canceled) {
          setQrState({
            source: value,
            dataUrl: '',
            error: 'Gagal generate QRIS. Coba refresh halaman atau buat ulang invoice jika tetap gagal.',
          })
        }
      })

    return () => {
      canceled = true
    }
  }, [isQris, value])

  const qrDataUrl = isQris && qrState.source === value ? qrState.dataUrl : ''
  const qrError = isQris && qrState.source === value ? qrState.error : ''

  useEffect(() => {
    if (!paymentRootRef.current) return
    if (!value && !actionUrl) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const scope = { current: createScope({ root: paymentRootRef }).add(() => {
      animate('[data-anime="payment-panel"]', {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 320,
        ease: 'out(3)',
      })
    }) }

    return () => scope.current.revert()
  }, [actionUrl, qrDataUrl, value])

  const handleCopy = async () => {
    if (!value || isHttpURL(value)) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div ref={paymentRootRef} data-anime="payment-panel" className={`rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-[#777] font-semibold">{methodLabel(normalizedMethod)}</div>
        {value && !isQris && !isHttpURL(value) ? (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[#E2E2E2] hover:bg-white"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Tersalin' : 'Copy'}
          </button>
        ) : null}
      </div>

      {!value && !actionUrl ? (
        <div className="text-sm text-[#999]">Kode pembayaran belum tersedia.</div>
      ) : isQris && value ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[#EBEBEB] bg-white p-3 flex items-center justify-center min-h-[180px]">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QRIS Payment" className="w-48 h-48 object-contain" />
            ) : (
              <div className="text-xs text-[#888] inline-flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                Menyiapkan QR...
              </div>
            )}
          </div>

          {qrError ? <div className="text-xs text-red-600">{qrError}</div> : null}

          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download="qris-payment.png"
              className="mx-auto flex w-fit items-center justify-center gap-2 rounded-xl bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e]"
            >
              <Download className="w-4 h-4" />
              Download QRIS
            </a>
          ) : null}
        </div>
      ) : isVA && value && !isHttpURL(value) ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1 text-xs text-[#777]">
            <Building2 className="w-3.5 h-3.5" />
            Nomor Virtual Account
          </div>
          <div className="rounded-lg border border-[#EBEBEB] bg-white px-3 py-4 font-mono text-sm md:text-base font-bold break-all text-[#141414]">
            {value}
          </div>
        </div>
      ) : actionUrl ? (
        <a
          href={actionUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#141414] px-4 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          <ExternalLink className="w-4 h-4" />
          Buka Halaman Pembayaran
        </a>
      ) : (
        <div className="font-mono text-xs break-all text-[#141414]">{value}</div>
      )}
    </div>
  )
}
