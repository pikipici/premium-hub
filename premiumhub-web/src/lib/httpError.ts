import type { AxiosError } from 'axios'

interface ApiErrorPayload {
  message?: string
}

export function getHttpErrorMessage(error: unknown, fallback: string): string {
  const axiosErr = error as AxiosError<ApiErrorPayload>
  return axiosErr.response?.data?.message || fallback
}
