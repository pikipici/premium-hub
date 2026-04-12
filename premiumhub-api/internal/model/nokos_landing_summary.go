package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NokosLandingCountry struct {
	Key      string `json:"key"`
	Name     string `json:"name"`
	ISO      string `json:"iso,omitempty"`
	DialCode string `json:"dial_code,omitempty"`
}

type NokosLandingSummary struct {
	ID                  uuid.UUID             `gorm:"type:uuid;primaryKey" json:"id"`
	Source              string                `gorm:"size:30;uniqueIndex;not null" json:"source"`
	CountriesCount      int64                 `gorm:"not null;default:0" json:"countries_count"`
	Countries           []NokosLandingCountry `gorm:"serializer:json" json:"countries"`
	SentTotalAllTime    int64                 `gorm:"not null;default:0" json:"sent_total_all_time"`
	PaymentMethods      []string              `gorm:"serializer:json" json:"payment_methods"`
	ActivationSentTotal int64                 `gorm:"not null;default:0" json:"activation_sent_total"`
	HostingSentTotal    int64                 `gorm:"not null;default:0" json:"hosting_sent_total"`
	LastSyncedAt        *time.Time            `json:"last_synced_at"`
	LastSyncStatus      string                `gorm:"size:20;not null;default:unknown" json:"last_sync_status"`
	LastSyncError       string                `gorm:"type:text" json:"last_sync_error,omitempty"`
	CreatedAt           time.Time             `json:"created_at"`
	UpdatedAt           time.Time             `json:"updated_at"`
}

func (n *NokosLandingSummary) BeforeCreate(_ *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	if n.Source == "" {
		n.Source = "5sim"
	}
	if n.LastSyncStatus == "" {
		n.LastSyncStatus = "unknown"
	}
	return nil
}
