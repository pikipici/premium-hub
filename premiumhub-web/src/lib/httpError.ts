import type { AxiosError } from 'axios'

interface ApiErrorPayload {
  message?: string
}

export function getHttpErrorMessage(error: unknown, fallback: string): string {
  const axiosErr = error as AxiosError<ApiErrorPayload>

  const apiMessage = axiosErr.response?.data?.message
  if (apiMessage) return apiMessage

  const rawMessage = String(axiosErr.message || '')
  if (axiosErr.code === 'ECONNABORTED' || /timeout/i.test(rawMessage)) {
    return 'Request timeout. Coba ulang beberapa saat lagi.'
  }

  return fallback
}
