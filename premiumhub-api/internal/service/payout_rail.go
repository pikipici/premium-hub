package service

import (
	"context"

	"github.com/google/uuid"
)

// PayoutRail abstracts the disbursement transport for wallet withdrawals.
//
// Two-phase commit pattern:
//
//	Submit       — admin approves a withdrawal; rail returns its
//	               native handle (railRef) and a tentative status. For
//	               manual rails the status is always "pending" and the
//	               admin posts the actual transfer themselves, then
//	               flips status with MarkPaid. For API rails (Duitku,
//	               Xendit, Flip, Tripay) the status may be "success"
//	               (sync rail) or "pending" (async rail) or "failed"
//	               (validation error before the rail accepts the job).
//	CheckStatus  — polled by a future reconcile worker for async rails
//	               to upgrade processing → paid/failed without admin
//	               intervention. For manual rails this just echoes
//	               pending forever — the worker should skip manual.
//
// Adding a new rail = drop a new file (e.g. payout_rail_duitku.go)
// implementing PayoutRail and wire it in router.go via env switch.
// No core service changes required.
type PayoutRailKind string

const (
	PayoutRailManual PayoutRailKind = "manual"
	PayoutRailDuitku PayoutRailKind = "duitku"
	PayoutRailXendit PayoutRailKind = "xendit"
	PayoutRailFlip   PayoutRailKind = "flip"
	PayoutRailTripay PayoutRailKind = "tripay"
)

// PayoutStatus mirrors the high-level outcome reported by the rail.
// The withdrawal state machine maps these to concrete WithdrawalStatus
// values in the service layer (see wallet_withdrawal_service.Approve).
type PayoutStatus string

const (
	PayoutStatusPending PayoutStatus = "pending"
	PayoutStatusSuccess PayoutStatus = "success"
	PayoutStatusFailed  PayoutStatus = "failed"
)

// PayoutRequest is the minimal contract a rail needs to start a
// payout. Net amount (after fee) is what hits the destination.
type PayoutRequest struct {
	WithdrawalID       uuid.UUID
	Amount             int64
	DestinationType    string
	DestinationCode    string
	DestinationAccount string
	DestinationName    string
}

// PayoutResult captures rail state. RawResp is JSON-stringified raw
// rail response (or empty for manual) — useful for forensics and
// reconciliation, never shown to the user.
type PayoutResult struct {
	Status  PayoutStatus
	RailRef string
	RawResp string
	Error   string
}

// PayoutRail is the polymorphic rail driver. Service holds *one*
// PayoutRail at a time (current "active" rail per env). Multi-rail
// routing (e.g. BCA via Flip + DANA via Xendit) is a future extension.
type PayoutRail interface {
	Kind() PayoutRailKind
	Submit(ctx context.Context, req PayoutRequest) (*PayoutResult, error)
	CheckStatus(ctx context.Context, railRef string) (*PayoutResult, error)
}
