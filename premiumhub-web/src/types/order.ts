export interface OrderProduct {
  id?: string
  name: string
  icon: string
  color?: string
}

export interface OrderPrice {
  id?: string
  product_id?: string
  duration: number
  account_type: string
  price: number
  is_active?: boolean
}

export interface OrderStock {
  id?: string
  product_id?: string
  account_type?: string
  email: string
  password: string
  profile_name?: string
  status?: string
  used_by?: string
  used_at?: string | null
  expires_at?: string | null
}

export interface OrderUser {
  id: string
  name: string
  email: string
  phone?: string
  role?: string
  is_active?: boolean
}

export interface Order {
  id: string
  user_id: string
  stock_id?: string | null
  price_id?: string
  product?: OrderProduct
  user?: OrderUser
  price: OrderPrice
  total_price: number
  payment_method?: string
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
  order_status: 'pending' | 'active' | 'completed' | 'failed'
  stock?: OrderStock
  midtrans_id?: string
  snap_token?: string
  paid_at: string | null
  expires_at?: string | null
  created_at: string
  updated_at?: string
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
