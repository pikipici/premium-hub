export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
  meta?: { page: number; limit: number; total: number; total_pages: number }
}
