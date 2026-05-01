"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

import { isTurnstileEnabled, turnstileSiteKey } from '@/lib/turnstile'

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileWidgetProps {
  action: 'login' | 'register'
  disabled?: boolean
  onTokenChange: (token: string) => void
  onError: (message: string) => void
}

export default function TurnstileWidget({
  action,
  disabled = false,
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = useMemo(() => turnstileSiteKey(), [])
  const turnstileEnabled = useMemo(() => isTurnstileEnabled(siteKey), [siteKey])
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!turnstileEnabled) {
      onTokenChange('')
      return
    }

    const mountWidget = () => {
      if (!rootRef.current || !window.turnstile) return
      rootRef.current.innerHTML = ''
      widgetIdRef.current = window.turnstile.render(rootRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => {
          setLoadFailed(false)
          onTokenChange(token)
        },
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => {
          onTokenChange('')
          onError('Verifikasi human gagal. Coba lagi.')
        },
      })
    }

    const handleScriptLoad = () => {
      setLoadFailed(false)
      mountWidget()
    }

    const handleScriptError = () => {
      setLoadFailed(true)
      onTokenChange('')
      onError('Gagal memuat verifikasi human')
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript) {
      if (window.turnstile) {
        handleScriptLoad()
        return
      }
      existingScript.addEventListener('load', handleScriptLoad)
      existingScript.addEventListener('error', handleScriptError)
      return () => {
        existingScript.removeEventListener('load', handleScriptLoad)
        existingScript.removeEventListener('error', handleScriptError)
      }
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', handleScriptLoad)
    script.addEventListener('error', handleScriptError)
    document.head.appendChild(script)

    return () => {
      script.removeEventListener('load', handleScriptLoad)
      script.removeEventListener('error', handleScriptError)
    }
  }, [action, onError, onTokenChange, siteKey, turnstileEnabled])

  useEffect(() => {
    return () => {
      const widgetId = widgetIdRef.current
      if (!widgetId || !window.turnstile) return
      window.turnstile.remove(widgetId)
    }
  }, [])

  if (!turnstileEnabled) return null

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div
        className={`rounded-xl border p-2 ${loadFailed ? 'border-red-200 bg-red-50' : 'border-[#EBEBEB] bg-[#FAFAF9]'}`}
      >
        <div ref={rootRef} className="min-h-[66px] flex items-center justify-center" />
        {loadFailed && (
          <p className="px-1 pt-1 text-xs text-red-600">
            Verifikasi human gagal dimuat. Refresh halaman lalu coba lagi.
          </p>
        )}
      </div>
    </div>
  )
}
