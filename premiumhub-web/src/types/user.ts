export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
}
