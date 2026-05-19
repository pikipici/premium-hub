// Admin-side Gmail marketplace types — mirror backend response shapes
// dari gmail_handler + gmail_admin_handler.

import type { GmailSlot } from './gmail'

// Re-export user-side types as needed (admin shares same row shape).
export type GmailAccount = GmailSlot & {
  password_enc?: string // tidak di-display, cuma cek presence
  buy_price?: number
  sold_price?: number
  sold_at?: string
  sold_to_user_id?: string
  sold_order_id?: string
  disposed_at?: string
  disposed_reason?: string
  rejected_by_admin_id?: string
  rejected_at?: string
}

// ----- Verify queue payloads (Round 1) -----
export interface GmailVerifyPayload {
  new_password: string
}

export interface GmailRejectPayload {
  reason: string
  note?: string
}

// ----- Inventory browser (Round 5) -----
export type GmailInventoryStatus =
  | 'pending_create'
  | 'pending_verify'
  | 'verified'
  | 'sold'
  | 'rejected'
  | 'expired'
  | 'disposed'

export interface GmailAdminInventoryListResponse {
  items: GmailAccount[]
  counts: Partial<Record<GmailInventoryStatus, number>>
}

// ----- Pricing config (Round 5) -----
export interface GmailDiscountTier {
  min_qty: number
  discount_pct: number
}

export interface GmailAdminPricing {
  id: string
  buy_price: number
  sell_price: number
  bulk_discount_enabled: boolean
  bulk_discount_tiers: string // JSON-encoded array
  low_inventory_threshold: number
  updated_at: string
  updated_by_admin_id?: string
}

export interface GmailAdminPricingUpdate {
  buy_price?: number
  sell_price?: number
  bulk_discount_enabled?: boolean
  bulk_discount_tiers?: GmailDiscountTier[]
  low_inventory_threshold?: number
}

// ----- Strike management (Round 5) -----
export interface GmailAdminStrikedUser {
  user_id: string
  user_email: string
  user_name: string
  active_strike_count: number
  banned_until?: string
}

// ----- Analytics (Round 5) -----
export interface GmailAdminWeekStats {
  week_start: string
  inventory_in: number
  inventory_out: number
  revenue: number
  cost: number
  margin: number
}

export interface GmailAdminAggregateStats {
  weeks: number
  inventory_in: number
  inventory_out: number
  revenue: number
  cost: number
  margin: number
}

export interface GmailAdminAnalytics {
  weeks: GmailAdminWeekStats[]
  totals: GmailAdminAggregateStats
}
