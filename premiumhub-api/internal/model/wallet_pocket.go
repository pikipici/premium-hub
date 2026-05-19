package model

// Wallet pocket constants — used by WalletLedger.Pocket and the
// per-pocket balance fields on User.
//
// Two pockets:
//   - "spend" (Saldo Utama): primary balance, fed by topup and Pendapatan→Utama
//     transfers, used for purchases (sosmed, digiconnect, premapps, gmail buy).
//   - "earn"  (Saldo Pendapatan): earnings balance, fed by sell-side flows
//     (e.g. gmail sell), withdrawable via wallet withdrawal flow. Cannot be
//     fed from topup directly — anti-money-laundering by design.
//
// Backward compat: every wallet_ledgers row created before the pocket
// migration defaults to "spend". User.WalletBalance maps 1:1 to spend pocket.
const (
	WalletPocketSpend = "spend"
	WalletPocketEarn  = "earn"
)

// IsValidWalletPocket returns true if pocket is one of the supported
// pocket identifiers. Use as a guard before persisting user-supplied
// pocket values.
func IsValidWalletPocket(pocket string) bool {
	switch pocket {
	case WalletPocketSpend, WalletPocketEarn:
		return true
	default:
		return false
	}
}
