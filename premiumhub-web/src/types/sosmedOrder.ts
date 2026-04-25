import type { SosmedService } from '@/types/sosmedService'

export type SosmedOrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'
export type SosmedOrderStatus = 'pending_payment' | 'processing' | 'success' | 'failed' | 'canceled' | 'expired'

export interface SosmedOrder {
  id: string
  user_id: string
  service_id: string
  service_code: string
  service_title: string
  target_link?: string
  quantity: number
  unit_price: number
  total_price: number
  payment_method?: string
  payment_status: SosmedOrderPaymentStatus
  order_status: SosmedOrderStatus
  gateway_order_id?: string
  payment_payload?: string
  provider_code?: string
  provider_service_id?: string
  provider_order_id?: string
  provider_status?: string
  provider_payload?: string
  provider_error?: string
  notes?: string
  paid_at?: string
  expires_at?: string
  created_at: string
  updated_at?: string
  service?: SosmedService
}

export interface SosmedOrderEvent {
  id: string
  order_id: string
  from_status: string
  to_status: string
  reason?: string
  internal_note?: string
  actor_type: 'user' | 'admin' | 'system' | string
  actor_id?: string
  created_at: string
}

export interface SosmedOrderDetail {
  order: SosmedOrder
  events: SosmedOrderEvent[]
}
