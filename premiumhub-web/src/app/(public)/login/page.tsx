"use client"

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/services/authService'
import { resolvePostAuthPath } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { getHttpErrorMessage } from '@/lib/httpError'
import { Eye, EyeOff, LogIn } from 'lucide-react'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser, user, isAuthenticated, hasHydrated, isBootstrapped } = useAuthStore()
  const authReady = hasHydrated && isBootstrapped
  const nextAuthPath = searchParams.get('next')

  useEffect(() => {
    if (!authReady || !isAuthenticated || !user) return
    router.replace(resolvePostAuthPath(nextAuthPath, user.role))
  }, [authReady, isAuthenticated, nextAuthPath, router, user])

  const registerHref = useMemo(() => {
    if (!nextAuthPath) return '/register'
    return `/register?next=${encodeURIComponent(nextAuthPath)}`
  }, [nextAuthPath])
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authService.login(form)
      if (res.success) {
        setUser(res.data.user)
        router.push(resolvePostAuthPath(nextAuthPath, res.data.user.role))
      }
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err, 'Login gagal'))
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
      setError(getHttpErrorMessage(err, 'Login Google gagal'))
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
              <h1 className="text-2xl font-extrabold mb-2">Selamat Datang</h1>
              <p className="text-sm text-[#888]">Masuk ke akun DigiMarket kamu</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-6 text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all"
                  placeholder="email@contoh.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#EBEBEB] text-sm focus:outline-none focus:border-[#FF5733] focus:ring-1 focus:ring-[#FF5733]/20 transition-all pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link href="/lupa-password" className="text-xs text-[#FF5733] font-medium hover:underline">
                  Lupa password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#FF5733] text-white font-bold rounded-full hover:bg-[#e64d2e] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {loading ? 'Memproses...' : <><LogIn className="w-4 h-4" /> Masuk</>}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#EBEBEB]" />
              <span className="text-xs text-[#888] font-medium">atau</span>
              <div className="h-px flex-1 bg-[#EBEBEB]" />
            </div>

            <GoogleSignInButton
              mode="login"
              disabled={loading}
              onToken={handleGoogleToken}
              onError={setError}
            />

            <p className="text-center text-sm text-[#888] mt-6">
              Belum punya akun?{' '}
              <Link href={registerHref} className="text-[#FF5733] font-semibold hover:underline">Daftar</Link>
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
