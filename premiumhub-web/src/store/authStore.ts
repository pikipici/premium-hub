import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  walletBalance: number
  hasHydrated: boolean
  isBootstrapped: boolean
  setUser: (u: User | null) => void
  setWalletBalance: (balance: number) => void
  logout: () => void
  setHasHydrated: (value: boolean) => void
  setBootstrapped: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      walletBalance: 0,
      hasHydrated: false,
      isBootstrapped: false,
      setUser: (user) =>
        set((state) => ({
          user,
          isAuthenticated: !!user,
          isBootstrapped: true,
          // Reset wallet only when user identity changes (different user or sign-out).
          // Otherwise keep existing balance to prevent flicker-to-zero on session refresh.
          walletBalance: user && state.user?.id === user.id ? state.walletBalance : 0,
        })),
      setWalletBalance: (walletBalance) => set({ walletBalance }),
      logout: () => set({ user: null, isAuthenticated: false, walletBalance: 0 }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
    }),
    {
      name: 'premiumhub-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // walletBalance intentionally NOT persisted — must always be fresh from server.
        // WalletBadge useQuery refetches on mount/focus, so no stale balance is shown.
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
