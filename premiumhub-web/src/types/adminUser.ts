export interface AdminUser {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  is_active: boolean
  wallet_balance: number
  created_at: string
  updated_at?: string
  total_orders: number
  paid_orders: number
  total_spent: number
  active_orders: number
  last_order_at?: string | null
}
