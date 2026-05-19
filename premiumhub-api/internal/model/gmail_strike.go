package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Gmail sell-side strike reasons. These are the rejection categories
// that count toward the 3-strikes-30-days auto-ban.
const (
	GmailStrikeReasonRecoverySet     = "recovery_set"     // user added recovery email/phone (forbidden)
	GmailStrikeReasonLoginFailed     = "login_failed"     // creds don't match (user submitted wrong / didn't create)
	GmailStrikeReasonFreshnessFailed = "freshness_failed" // account isn't fresh (history, recovery existed before)
	GmailStrikeReasonOther           = "other"            // admin manual reason
)

// GmailStrike records each rejected sell submission. Linked back to
// the gmail account row that triggered it for audit. Used by
// strike-counting query (rolling 30-day window) to decide auto-ban.
type GmailStrike struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID         uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	GmailAccountID uuid.UUID `gorm:"type:uuid;not null" json:"gmail_account_id"`
	Reason         string    `gorm:"type:varchar(32);not null" json:"reason"`
	Note           string    `gorm:"type:text" json:"note,omitempty"`
	AdminID        uuid.UUID `gorm:"type:uuid;not null" json:"admin_id"`
	CreatedAt      time.Time `json:"created_at"`
}

func (g *GmailStrike) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}
