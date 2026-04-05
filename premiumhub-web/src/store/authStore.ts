import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  walletBalance: number
  hasHydrated: boolean
  setUser: (u: User | null) => void
  setWalletBalance: (balance: number) => void
  logout: () => void
  setHasHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      walletBalance: 0,
      hasHydrated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user, walletBalance: 0 }),
      setWalletBalance: (walletBalance) => set({ walletBalance }),
      logout: () => set({ user: null, isAuthenticated: false, walletBalance: 0 }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'premiumhub-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        walletBalance: state.walletBalance,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
