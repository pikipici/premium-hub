export interface Order {
  id: string
  user_id: string
  product: { name: string; icon: string; color: string }
  price: { duration: number; account_type: string; price: number }
  total_price: number
  payment_method: string
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
  order_status: 'pending' | 'active' | 'completed' | 'failed'
  stock?: { email: string; password: string; profile_name?: string }
  paid_at: string | null
  expires_at: string
  created_at: string
}

export interface Claim {
  id: string
  order_id: string
  reason: 'login' | 'password' | 'kicked' | 'profile' | 'quality' | 'other'
  description: string
  screenshot_url?: string
  status: 'pending' | 'approved' | 'rejected'
  admin_note?: string
  created_at: string
}
