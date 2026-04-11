"use client"

import { useEffect, useMemo, useState } from 'react'
import { Building2, Copy, QrCode } from 'lucide-react'
import QRCode from 'qrcode'

type PakasirPaymentDisplayProps = {
  paymentMethod?: string
  paymentNumber?: string
  className?: string
}

type QRState = {
  source: string
  dataUrl: string
  error: string
}

const normalizeMethod = (value?: string) => (value || '').trim().toLowerCase()

const methodLabel = (value?: string) => {
  const method = normalizeMethod(value)
  switch (method) {
    case 'qris':
      return 'QRIS'
    case 'bri_va':
      return 'BRI Virtual Account'
    case 'bni_va':
      return 'BNI Virtual Account'
    case 'permata_va':
      return 'Permata Virtual Account'
    default:
      return method ? method.toUpperCase() : 'Payment Number'
  }
}

export default function PakasirPaymentDisplay({ paymentMethod, paymentNumber, className }: PakasirPaymentDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [qrState, setQrState] = useState<QRState>({ source: '', dataUrl: '', error: '' })

  const normalizedMethod = useMemo(() => normalizeMethod(paymentMethod), [paymentMethod])
  const isQris = normalizedMethod === 'qris'
  const isVA = normalizedMethod.endsWith('_va')
  const value = (paymentNumber || '').trim()

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
            error: 'Gagal generate QR. Copy QR string lalu bayar dari aplikasi yang support QRIS string.',
          })
        }
      })

    return () => {
      canceled = true
    }
  }, [isQris, value])

  const qrDataUrl = isQris && qrState.source === value ? qrState.dataUrl : ''
  const qrError = isQris && qrState.source === value ? qrState.error : ''

  const handleCopy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className={`rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3 ${className || ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-[#777] font-semibold">{methodLabel(normalizedMethod)}</div>
        {value ? (
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

      {!value ? (
        <div className="text-sm text-[#999]">Payment number belum tersedia.</div>
      ) : isQris ? (
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

          <details className="text-xs text-[#666]">
            <summary className="cursor-pointer select-none">Lihat QR string mentah</summary>
            <div className="mt-2 font-mono break-all text-[#141414]">{value}</div>
          </details>
        </div>
      ) : isVA ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1 text-xs text-[#777]">
            <Building2 className="w-3.5 h-3.5" />
            Nomor Virtual Account
          </div>
          <div className="rounded-lg border border-[#EBEBEB] bg-white px-3 py-4 font-mono text-sm md:text-base font-bold break-all text-[#141414]">
            {value}
          </div>
        </div>
      ) : (
        <div className="font-mono text-xs break-all text-[#141414]">{value}</div>
      )}
    </div>
  )
}
