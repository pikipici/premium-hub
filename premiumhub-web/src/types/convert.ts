export type ConvertAssetType = 'pulsa' | 'paypal' | 'crypto'

export type ConvertOrderStatus =
  | 'draft'
  | 'pending_transfer'
  | 'waiting_review'
  | 'approved'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired'
  | 'canceled'

export interface ConvertPricingSnapshot {
  rate: number
  admin_fee: number
  risk_fee: number
  transfer_fee: number
  guest_surcharge: number
  ppn_rate: number
  ppn_amount: number
}

export interface ConvertOrderSummary {
  id: string
  user_id: string
  user_name?: string
  user_email?: string
  asset_type: ConvertAssetType
  status: ConvertOrderStatus
  is_guest: boolean
  source_amount: number
  source_channel: string
  source_account: string
  destination_bank: string
  destination_account_number: string
  destination_account_name: string
  converted_amount: number
  total_fee: number
  receive_amount: number
  pricing_snapshot: ConvertPricingSnapshot
  tracking_token?: string
  idempotency_key?: string
  notes?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface ConvertOrderEvent {
  id: string
  order_id: string
  from_status: string
  to_status: string
  reason?: string
  internal_note?: string
  actor_type: 'user' | 'admin' | string
  actor_id?: string
  created_at: string
}

export type ConvertProofType = 'user_payment' | 'admin_settlement' | string

export interface ConvertProof {
  id: string
  order_id: string
  file_url: string
  file_name?: string
  mime_type?: string
  file_size: number
  note?: string
  proof_type: ConvertProofType
  uploaded_by_type: 'user' | 'admin' | 'guest' | string
  uploaded_by_id?: string
  created_at: string
}

export interface ConvertOrderDetail {
  order: ConvertOrderSummary
  events: ConvertOrderEvent[]
  proofs: ConvertProof[]
  user_proofs: ConvertProof[]
  admin_settlement_proofs: ConvertProof[]
}

export interface CreateConvertOrderPayload {
  asset_type: ConvertAssetType
  source_amount: number
  source_channel: string
  source_account: string
  destination_bank: string
  destination_account_number: string
  destination_account_name: string
  is_guest?: boolean
  notes?: string
  idempotency_key?: string
}

export interface UploadConvertProofPayload {
  file_url?: string
  file_name?: string
  mime_type?: string
  file_size?: number
  note?: string
}

export interface ConvertListParams {
  page?: number
  limit?: number
  asset_type?: ConvertAssetType
  status?: ConvertOrderStatus
  q?: string
}

export interface ConvertPricingRule {
  asset_type: ConvertAssetType
  enabled: boolean
  rate: number
  admin_fee: number
  risk_fee: number
  transfer_fee: number
  guest_surcharge: number
  ppn_rate: number
}

export interface ConvertLimitRule {
  asset_type: ConvertAssetType
  enabled: boolean
  allow_guest: boolean
  require_login: boolean
  min_amount: number
  max_amount: number
  daily_limit: number
  manual_review_threshold: number
}
