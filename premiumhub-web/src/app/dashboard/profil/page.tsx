"use client"

import { useEffect, useState } from 'react'
import { Check, KeyRound, Loader2, Mail, ShieldCheck, User as UserIcon } from 'lucide-react'

import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import { getHttpErrorMessage } from '@/lib/httpError'

type SaveState = { type: '' | 'success' | 'error'; text: string }

export default function ProfilPage() {
  const { user, setUser } = useAuthStore()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<SaveState>({ type: '', text: '' })

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<SaveState>({ type: '', text: '' })

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setPhone(user.phone || '')
  }, [user])

  const profileChanged = (user?.name || '') !== name.trim() || (user?.phone || '') !== phone.trim()

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setProfileMsg({ type: '', text: '' })

    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileMsg({ type: 'error', text: 'Nama tidak boleh kosong.' })
      return
    }

    setSavingProfile(true)
    try {
      const res = await authService.updateProfile({ name: trimmedName, phone: phone.trim() || undefined })
      if (res.success) {
        setUser(res.data)
        setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui.' })
      } else {
        setProfileMsg({ type: 'error', text: res.message || 'Gagal memperbarui profil.' })
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: getHttpErrorMessage(err, 'Gagal memperbarui profil.') })
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordMsg({ type: '', text: '' })

    if (!oldPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Password lama dan baru wajib diisi.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password baru minimal 8 karakter.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' })
      return
    }

    setSavingPassword(true)
    try {
      const res = await authService.changePassword({ old_password: oldPassword, new_password: newPassword })
      if (res.success) {
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setPasswordMsg({ type: 'success', text: 'Password berhasil diganti. Pakai password baru di sesi berikutnya.' })
      } else {
        setPasswordMsg({ type: 'error', text: res.message || 'Gagal mengganti password.' })
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: getHttpErrorMessage(err, 'Gagal mengganti password.') })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#141414]">Profil</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Kelola informasi akun dan keamanan kamu di sini.</p>
      </header>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-[#FF5733]" />
          <h2 className="text-sm font-bold text-[#141414]">Informasi Akun</h2>
        </div>

        {profileMsg.text ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              profileMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {profileMsg.text}
          </div>
        ) : null}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label htmlFor="profil-email" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                id="profil-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-xl border border-[#EBEBEB] bg-[#F7F7F5] py-2.5 pl-10 pr-3 text-sm font-semibold text-[#3A3A3A]"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#6B7280]">Email tidak bisa diganti dari sini. Hubungi support kalau perlu ubah.</p>
          </div>

          <div>
            <label htmlFor="profil-name" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Nama
            </label>
            <input
              id="profil-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
              placeholder="Nama panggilan kamu"
              required
            />
          </div>

          <div>
            <label htmlFor="profil-phone" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Nomor HP <span className="font-normal text-[#A6A6A1]">(opsional)</span>
            </label>
            <input
              id="profil-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={20}
              className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={savingProfile || !profileChanged}
              className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 shadow-[0_16px_38px_rgba(20,20,20,0.06)] md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#FF5733]" />
          <h2 className="text-sm font-bold text-[#141414]">Ganti Password</h2>
        </div>

        {passwordMsg.text ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              passwordMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
            role="status"
            aria-live="polite"
          >
            {passwordMsg.text}
          </div>
        ) : null}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="profil-old-password" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
              Password Lama
            </label>
            <input
              id="profil-old-password"
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="profil-new-password" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
                Password Baru
              </label>
              <input
                id="profil-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
                autoComplete="new-password"
                required
              />
              <p className="mt-1 text-[11px] text-[#6B7280]">Minimal 8 karakter.</p>
            </div>

            <div>
              <label htmlFor="profil-confirm-password" className="mb-1.5 block text-xs font-semibold text-[#6B7280]">
                Konfirmasi Password Baru
              </label>
              <input
                id="profil-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm text-[#141414] focus:border-[#FF5733] focus:outline-none"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 rounded-full bg-[#141414] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {savingPassword ? 'Memproses...' : 'Ganti Password'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold text-[#141414]">Butuh hapus akun?</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Permintaan penghapusan akun ditangani manual oleh tim support biar saldo dan riwayat order kamu aman. Kontak via Chat Support.
        </p>
        <div className="mt-3">
          <a
            href="/dashboard/chat"
            className="inline-flex items-center gap-2 rounded-full border border-[#EBEBEB] bg-white px-4 py-2 text-sm font-bold text-[#141414] transition-colors hover:bg-[#F7F7F5]"
          >
            Hubungi Support
          </a>
        </div>
      </section>
    </div>
  )
}
