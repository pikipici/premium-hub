package service

import "context"

// ManualPayoutRail is the default implementation: admin transfers
// money out-of-band (real bank/e-wallet transfer) and then flips the
// withdrawal to paid via the admin UI.
//
// Properties:
//   - Submit always returns Status=pending, RailRef=""
//   - CheckStatus always returns Status=pending (never auto-resolves)
//
// This is the safest starting rail: no third-party dependency, no
// API keys, no failure modes outside the admin's own typing.
// Migrating to an API rail (Duitku/Xendit/Flip/Tripay) is a drop-in:
// add new file implementing PayoutRail and switch via env var.
type ManualPayoutRail struct{}

func NewManualPayoutRail() *ManualPayoutRail {
	return &ManualPayoutRail{}
}

func (m *ManualPayoutRail) Kind() PayoutRailKind { return PayoutRailManual }

func (m *ManualPayoutRail) Submit(_ context.Context, _ PayoutRequest) (*PayoutResult, error) {
	// Manual rails don't actually submit anything — they just hand
	// off to the admin. Status=pending so the service layer flips
	// the withdrawal to "processing" and waits for human action.
	return &PayoutResult{
		Status:  PayoutStatusPending,
		RailRef: "",
		RawResp: "",
	}, nil
}

func (m *ManualPayoutRail) CheckStatus(_ context.Context, ref string) (*PayoutResult, error) {
	// No reconciliation possible for manual — no upstream system to
	// poll. Reconcile worker (when it exists) must skip manual rails.
	return &PayoutResult{
		Status:  PayoutStatusPending,
		RailRef: ref,
	}, nil
}
