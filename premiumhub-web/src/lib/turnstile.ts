export function turnstileSiteKey(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim()
}

export function isTurnstileEnabled(siteKey: string): boolean {
  return siteKey.trim().length > 0
}

export function canSubmitAuth(loading: boolean, requiresTurnstile: boolean, token: string): boolean {
  if (loading) return false
  if (!requiresTurnstile) return true
  return token.trim().length > 0
}
