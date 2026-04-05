import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  walletBalance: number
  setUser: (u: User | null) => void
  setWalletBalance: (balance: number) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      walletBalance: 0,
      setUser: (user) => set({ user, isAuthenticated: !!user, walletBalance: 0 }),
      setWalletBalance: (walletBalance) => set({ walletBalance }),
      logout: () => set({ user: null, isAuthenticated: false, walletBalance: 0 }),
    }),
    { name: 'premiumhub-auth' }
  )
)
