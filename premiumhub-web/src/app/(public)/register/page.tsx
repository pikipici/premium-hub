"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import TurnstileWidget from '@/components/auth/TurnstileWidget'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/services/authService'
import { resolvePostAuthPath } from '@/lib/auth'
import { canSubmitAuth, isTurnstileEnabled, turnstileSiteKey } from '@/lib/turnstile'
import { useAuthStore } from '@/store/authStore'
import { getHttpErrorMessage } from '@/lib/httpError'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser, user, isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped
  const nextAuthPath = searchParams.get('next')

  useEffect(() => {
    if (!authReady || !isAuthenticated || !user) return
    router.replace(resolvePostAuthPath(nextAuthPath, user.role))
  }, [authReady, isAuthenticated, nextAuthPath, router, user])

  const loginHref = useMemo(() => {
    if (!nextAuthPath) return '/login'
    return `/login?next=${encodeURIComponent(nextAuthPath)}`
  }, [nextAuthPath])
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [turnstileToken, setTurnstileToken] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const turnstileEnabled = useMemo(() => isTurnstileEnabled(turnstileSiteKey()), [])
  const canSubmit = canSubmitAuth(loading, turnstileEnabled, turnstileToken)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Password tidak sama')
      return
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter')
      return
    }
    if (turnstileEnabled && !turnstileToken.trim()) {
      setError('Selesaikan verifikasi human dulu')
      return
    }

    setLoading(true)
    try {
      const res = await authService.register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        turnstile_token: turnstileEnabled ? turnstileToken : undefined,
      })
      if (res.success) {
        setUser(res.data.user)
        router.push(resolvePostAuthPath(nextAuthPath, res.data.user.role))
      }
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Registrasi gagal'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleToken = useCallback(async (idToken: string) => {
    setError('')
    setLoading(true)
    try {
      const res = await authService.googleLogin({ id_token: idToken })
      if (res.success) {
        setUser(res.data.user)
        router.push(resolvePostAuthPath(nextAuthPath, res.data.user.role))
      }
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Google signup gagal'))
    } finally {
      setLoading(false)
    }
  }, [nextAuthPath, router, setUser])

  if (authReady && isAuthenticated) return null

  return (
    <>
      <Navbar />
      <section className="flex-1 flex items-center justify-center py-16">
        <div className="w-full max-w-md px-4">
          <div className="bg-white rounded-3xl shadow-sm border border-[#EBEBEB] p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold mb-2">Buat Akun Baru</h1>
              <p className="text-sm text-[#888]">Daftar gratis untuk mulai berbelanja</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6 text-center font-medium">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Nama Lengkap</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all"
                  placeholder="John Doe" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all"
                  placeholder="email@contoh.com" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">No. Telepon (Opsional)</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all"
                  placeholder="081234567890" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all pr-10"
                    placeholder="Min. 6 karakter" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Konfirmasi Password</label>
                <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all"
                  placeholder="Ulangi password" required />
              </div>

              <TurnstileWidget
                action="register"
                disabled={loading}
                onTokenChange={setTurnstileToken}
                onError={setError}
              />
              {turnstileEnabled && !turnstileToken && (
                <p className="text-xs text-[#888]">Selesaikan verifikasi human untuk lanjut daftar.</p>
              )}

              <button type="submit" disabled={!canSubmit}
                className="w-full py-3.5 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                {loading ? 'Memproses...' : <><UserPlus className="w-4 h-4" /> Daftar</>}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#EBEBEB]" />
              <span className="text-xs text-[#888] font-medium">atau</span>
              <div className="h-px flex-1 bg-[#EBEBEB]" />
            </div>

            <GoogleSignInButton
              mode="signup"
              disabled={loading}
              onToken={handleGoogleToken}
              onError={setError}
            />

            <p className="text-center text-sm text-[#888] mt-6">
              Sudah punya akun?{' '}
              <Link href={loginHref} className="text-[#FF5733] font-semibold hover:underline">Masuk</Link>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  )
}
