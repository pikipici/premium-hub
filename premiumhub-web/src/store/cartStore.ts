import { create } from 'zustand'

interface CartItem {
  productId: string
  productName: string
  priceId: string
  duration: number
  accountType: string
  price: number
  fulfillmentType?: string
}

interface CartState {
  item: CartItem | null
  setItem: (i: CartItem) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()((set) => ({
  item: null,
  setItem: (item) => set({ item }),
  clearCart: () => set({ item: null }),
}))
