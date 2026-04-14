export type MaintenanceTargetType = 'global' | 'prefix' | 'exact'

export interface MaintenanceRule {
  id: string
  name: string
  target_type: MaintenanceTargetType
  target_path: string
  title?: string
  message?: string
  is_active: boolean
  allow_admin_bypass: boolean
  starts_at?: string | null
  ends_at?: string | null
  created_at: string
  updated_at: string
}

export interface MaintenanceEvaluation {
  active: boolean
  title?: string
  message?: string
  rule?: MaintenanceRule
}
