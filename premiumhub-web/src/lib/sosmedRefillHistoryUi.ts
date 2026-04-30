export function isRefillHistoryExpanded(openOrderID: string | null, orderID: string) {
  return openOrderID === orderID
}

export function getRefillHistoryToggleLabel(claimCount: number, expanded: boolean) {
  if (expanded) return 'Sembunyikan Riwayat Refill'
  return `Lihat Riwayat Refill (${claimCount}x)`
}
