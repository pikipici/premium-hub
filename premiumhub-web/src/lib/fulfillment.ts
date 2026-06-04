export type FulfillmentType = 'credential' | 'license_key' | 'voucher_code' | 'download_link' | 'manual'

export function fulfillmentTypeLabel(type?: string | null): string {
  const normalized = (type || '').trim().toLowerCase()
  switch (normalized) {
    case 'credential':
      return 'Credential'
    case 'license_key':
      return 'License Key'
    case 'voucher_code':
      return 'Kode Voucher'
    case 'download_link':
      return 'Link Download'
    case 'manual':
      return 'Manual Delivery'
    default:
      return 'Credential'
  }
}

export function isCredentialFulfillment(type?: string | null): boolean {
  const normalized = (type || '').trim().toLowerCase()
  return !normalized || normalized === 'credential'
}

export function fulfillmentDefaultLabel(type?: string | null): string {
  const normalized = (type || '').trim().toLowerCase()
  switch (normalized) {
    case 'credential':
      return 'Email / Password'
    case 'license_key':
      return 'License Key'
    case 'voucher_code':
      return 'Kode Voucher'
    case 'download_link':
      return 'Link Download'
    case 'manual':
      return 'Instruksi Delivery'
    default:
      return 'Email / Password'
  }
}
