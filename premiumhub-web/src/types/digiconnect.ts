export interface DigiConnectPlan {
  code: string
  name: string
  description: string
  price: number
  duration_days: number
  daily_fair_use_limit: number
  pay_per_request_enabled: boolean
}

export interface DigiConnectCheckoutPayload {
  plan_code: string
}

export interface DigiConnectSummary {
  enabled: boolean
  status: string
  active_plan_code?: string
  expires_at?: string | null
  pay_per_request_enabled: boolean
  api_keys_count: number
}

export interface DigiConnectApiKey {
  id: string
  name: string
  key_prefix: string
  masked_key: string
  plain_key?: string
  status: string
  last_used_at?: string | null
  created_at: string
}

export interface DigiConnectEntitlement {
  id: string
  user_id: string
  plan_code: string
  billing_model: string
  status: string
  price: number
  starts_at: string
  expires_at?: string | null
  pay_per_request_enabled: boolean
  overage_pay_per_request_enabled: boolean
  daily_fair_use_limit: number
  custom_rate_limit_profile?: string
  last_used_at?: string | null
  created_at: string
}

export interface DigiConnectRequest {
  id: string
  request_id: string
  service_alias: string
  request_type: string
  status: string
  input_preview: string
  billing_decision: string
  billing_status: string
  billing_source: string
  amount: number
  currency: string
  public_error_code?: string
  router_status: number
  router_latency_ms: number
  started_at?: string | null
  completed_at?: string | null
  created_at: string
}

export interface DigiConnectAdminOverview {
  router: Record<string, unknown>
  status_counts: Record<string, number>
  today_counts: Record<string, number>
  charged_count: number
  charged_amount: number
  generated_at: string
}

export interface DigiConnectListParams {
  page?: number
  limit?: number
  status?: string
  billing_decision?: string
  user_id?: string
}

export interface DigiConnectProvisionEntitlementPayload {
  user_id: string
  plan_code: string
  billing_model?: string
  price: number
  duration_days: number
  pay_per_request_enabled: boolean
  overage_pay_per_request_enabled: boolean
  daily_fair_use_limit: number
  custom_rate_limit_profile?: string
}
