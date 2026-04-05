"use client"

import { useEffect, useRef } from 'react'

interface GoogleSignInButtonProps {
  mode: 'login' | 'signup'
  disabled?: boolean
  onToken: (idToken: string) => Promise<void>
  onError: (message: string) => void
}

const GOOGLE_SCRIPT_ID = 'google-identity-services-script'

export default function GoogleSignInButton({ mode, disabled = false, onToken, onError }: GoogleSignInButtonProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim()

  useEffect(() => {
    if (!clientId) return

    const renderGoogleButton = () => {
      if (!rootRef.current || !window.google?.accounts?.id) return

      rootRef.current.innerHTML = ''

      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        callback: (response) => {
          if (!response.credential) {
            onError('Google tidak mengirim token login')
            return
          }
          void onToken(response.credential).catch(() => undefined)
        },
      })

      window.google.accounts.id.renderButton(rootRef.current, {
        theme: 'outline',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'pill',
        width: 320,
        logo_alignment: 'left',
      })
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (window.google?.accounts?.id) {
        renderGoogleButton()
        return
      }
      existing.addEventListener('load', renderGoogleButton)
      return () => existing.removeEventListener('load', renderGoogleButton)
    }

    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.addEventListener('load', renderGoogleButton)
    script.addEventListener('error', () => onError('Gagal memuat Google Sign-In script'))
    document.head.appendChild(script)

    return () => script.removeEventListener('load', renderGoogleButton)
  }, [clientId, mode, onError, onToken])

  if (!clientId) {
    return (
      <div className="w-full text-center text-xs text-[#888] bg-[#F7F7F5] border border-[#EBEBEB] rounded-xl py-3">
        Google Sign-In belum dikonfigurasi
      </div>
    )
  }

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div ref={rootRef} className="w-full flex justify-center" />
    </div>
  )
}
