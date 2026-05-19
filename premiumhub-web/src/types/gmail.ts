// Gmail marketplace types — mirror backend DTOs in
// premiumhub-api/internal/model and the response shapes returned by
// gmail_handler / gmail_buy_handler / gmail_warranty_handler.

export type GmailSlotStatus =
  | 'pending_create'
  | 'pending_verify'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'sold'
  | 'disposed'

export type GmailOrderStatus = 'completed' | 'refunded'

export type GmailClaimStatus = 'replaced' | 'refunded' | 'rejected'

// One slot row (sell-side). Plain password ONLY filled at the moment
// the slot is generated (RequestSlot response). Subsequent fetches
// will not return password — UI must persist client-side once.
export interface GmailSlot {
  id: string
  status: GmailSlotStatus
  email: string
  password?: string | null
  password_version?: string
  slot_expires_at?: string | null
  submitted_at?: string | null
  verified_at?: string | null
  rejected_at?: string | null
  reject_reason?: string
  reject_note?: string
  seller_payout_amount?: number
  seller_payout_ledger_id?: string | null
  sold_at?: string | null
  disposed_at?: string | null
  disposed_reason?: string
  created_at: string
  updated_at: string
}

// Slot generation response is special — backend wraps slot in a
// SlotResponse with separate plain password and the slot row.
export interface GmailSlotResponse {
  slot: GmailSlot
  email: string
  password: string
  expires_at: string
}

// Pricing config exposed via /public/gmail/pricing.
export interface GmailPricingPreview {
  sell_price: number
  bulk_discount_enabled: boolean
  bulk_discount_tiers?: Array<{
    min_qty: number
    discount_pct: number
  }>
}

// Public stock signal — verified pool count, refresh every 60s.
export interface GmailAvailability {
  available: number
}

export interface GmailOrder {
  id: string
  user_id: string
  quantity: number
  unit_price: number
  gross_amount: number
  discount_amount: number
  discount_tier_pct: number
  net_amount: number
  status: GmailOrderStatus
  debit_ledger_id?: string | null
  refund_ledger_id?: string | null
  refunded_at?: string | null
  created_at: string
  updated_at: string
  items?: GmailSlot[]
}

// Per-item creds. Returned by Buy() and GET /orders/:id —
// password decrypted server-side, plain text on wire (HTTPS only).
export interface GmailOrderItemCreds {
  gmail_account_id: string
  email: string
  password: string
}

// Buy mutation response.
export interface GmailBuyResult {
  order: GmailOrder
  items: GmailOrderItemCreds[]
}

// Order detail (with creds) response.
export interface GmailOrderDetail {
  order: GmailOrder
  items: GmailOrderItemCreds[]
}

// Warranty claim row.
export interface GmailClaim {
  id: string
  buyer_id: string
  gmail_order_id: string
  gmail_account_id: string
  status: GmailClaimStatus
  resolution_type: string
  reason?: string
  replacement_gmail_account_id?: string | null
  refund_ledger_id?: string | null
  refund_amount: number
  resolved_at: string
  created_at: string
  updated_at: string
}

// Claim mutation response — replacement (with creds via order detail
// re-fetch) or refund metadata.
export interface GmailClaimResult {
  claim: GmailClaim
  replacement?: GmailSlot | null
  refund_amount?: number
  refunded_to_wallet_balance?: boolean
}

export interface CreateClaimPayload {
  gmail_account_id: string
  reason: string
}

export interface BuyPayload {
  quantity: number
}
