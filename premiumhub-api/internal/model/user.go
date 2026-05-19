package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name              string         `gorm:"size:100;not null" json:"name"`
	Email             string         `gorm:"size:150;uniqueIndex;not null" json:"email"`
	Phone             string         `gorm:"size:20" json:"phone"`
	Password          string         `gorm:"size:255;not null" json:"-"`
	GoogleSub         *string        `gorm:"size:191;uniqueIndex" json:"-"`
	Role              string         `gorm:"size:20;default:user" json:"role"`
	IsActive          bool           `gorm:"default:true" json:"is_active"`
	// WalletBalance is the "Saldo Utama" (spend pocket) — fed by topup,
	// consumed by purchases. Backward compatible with legacy single-pocket
	// callers that read/write this column directly.
	WalletBalance     int64 `gorm:"not null;default:0" json:"wallet_balance"`
	// WalletBalanceEarn is the "Saldo Pendapatan" (earn pocket) — fed by
	// sell-side flows (gmail sell, future earnings sources), withdrawable
	// via wallet withdrawal. Cannot be fed by topup. See
	// model/wallet_pocket.go for pocket semantics.
	WalletBalanceEarn int64 `gorm:"not null;default:0" json:"wallet_balance_earn"`

	// GmailSellBannedUntil — temporal flag. Set when user accumulates 3
	// gmail-sell strikes within a 30-day rolling window. While
	// now < this timestamp, RequestSlot returns 403 with remaining
	// duration. Cleared automatically by clock-tick (no scheduled
	// reset job needed).
	GmailSellBannedUntil *time.Time `json:"gmail_sell_banned_until,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (u *User) BeforeCreate(_ *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
