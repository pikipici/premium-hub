package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DigiConnectAPIKey struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	User   User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	Name       string     `gorm:"size:100" json:"name"`
	KeyPrefix  string     `gorm:"size:32;not null;index" json:"key_prefix"`
	KeyHash    string     `gorm:"size:128;not null;uniqueIndex" json:"-"`
	Status     string     `gorm:"size:20;not null;default:active;index" json:"status"`
	LastUsedAt *time.Time `json:"last_used_at"`
	RevokedAt  *time.Time `json:"revoked_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

func (k *DigiConnectAPIKey) BeforeCreate(_ *gorm.DB) error {
	if k.ID == uuid.Nil {
		k.ID = uuid.New()
	}
	return nil
}

type DigiConnectEntitlement struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	UserID uuid.UUID `gorm:"type:uuid;not null;index;index:idx_digiconnect_entitlement_active,priority:1" json:"user_id"`
	User   User      `gorm:"foreignKey:UserID" json:"user,omitempty"`

	PlanCode                    string     `gorm:"size:60;not null;index" json:"plan_code"`
	BillingModel                string     `gorm:"size:40;not null;index" json:"billing_model"`
	Status                      string     `gorm:"size:30;not null;default:active;index;index:idx_digiconnect_entitlement_active,priority:2" json:"status"`
	Price                       int64      `gorm:"not null;default:0" json:"price"`
	StartsAt                    time.Time  `gorm:"not null;index" json:"starts_at"`
	ExpiresAt                   *time.Time `gorm:"index;index:idx_digiconnect_entitlement_active,priority:3" json:"expires_at"`
	PayPerRequestEnabled        bool       `gorm:"not null;default:false" json:"pay_per_request_enabled"`
	OveragePayPerRequestEnabled bool       `gorm:"not null;default:false" json:"overage_pay_per_request_enabled"`
	DailyFairUseLimit           int        `gorm:"not null;default:0" json:"daily_fair_use_limit"`
	CustomRateLimitProfile      string     `gorm:"size:60" json:"custom_rate_limit_profile"`
	LastUsedAt                  *time.Time `json:"last_used_at"`
	CancelledAt                 *time.Time `json:"cancelled_at"`
	CreatedAt                   time.Time  `json:"created_at"`
	UpdatedAt                   time.Time  `json:"updated_at"`
}

func (e *DigiConnectEntitlement) BeforeCreate(_ *gorm.DB) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return nil
}

type DigiConnectRequest struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	RequestID string    `gorm:"size:80;not null;uniqueIndex" json:"request_id"`

	UserID   uuid.UUID          `gorm:"type:uuid;not null;index;uniqueIndex:idx_digiconnect_request_idempotency" json:"user_id"`
	User     User               `gorm:"foreignKey:UserID" json:"user,omitempty"`
	APIKeyID *uuid.UUID         `gorm:"type:uuid;index" json:"api_key_id,omitempty"`
	APIKey   *DigiConnectAPIKey `gorm:"foreignKey:APIKeyID" json:"api_key,omitempty"`

	ServiceAlias   string `gorm:"size:80;not null;index" json:"service_alias"`
	RequestType    string `gorm:"size:40;not null;index" json:"request_type"`
	PlanCode       string `gorm:"size:60;index" json:"plan_code,omitempty"`
	RouterProvider string `gorm:"size:40;index" json:"router_provider,omitempty"`
	RouterModel    string `gorm:"size:120" json:"router_model,omitempty"`
	Status         string `gorm:"size:40;not null;default:queued;index" json:"status"`

	InputHash    string `gorm:"size:128;index" json:"-"`
	InputPreview string `gorm:"size:240" json:"input_preview"`
	PayloadHash  string `gorm:"size:128;not null;index" json:"-"`
	OptionsJSON  string `gorm:"type:text" json:"options_json,omitempty"`
	MetadataJSON string `gorm:"type:text" json:"metadata_json,omitempty"`
	ExternalID   string `gorm:"size:120;index" json:"external_id,omitempty"`

	IdempotencyKey         *string `gorm:"size:100;uniqueIndex:idx_digiconnect_request_idempotency" json:"-"`
	IdempotencyRequestHash string  `gorm:"size:128" json:"-"`

	BillingDecision string `gorm:"size:40;not null;default:not_billable;index" json:"billing_decision"`
	BillingStatus   string `gorm:"size:40;not null;default:none;index" json:"billing_status"`
	BillingSource   string `gorm:"size:40;not null;default:none" json:"billing_source"`
	Amount          int64  `gorm:"not null;default:0" json:"amount"`
	Currency        string `gorm:"size:10;not null;default:IDR" json:"currency"`
	WalletReference string `gorm:"size:140;index" json:"wallet_reference,omitempty"`

	RateLimitResult         string `gorm:"size:40;index" json:"rate_limit_result,omitempty"`
	RateLimitRule           string `gorm:"size:120" json:"rate_limit_rule,omitempty"`
	AbuseScore              int    `gorm:"not null;default:0" json:"abuse_score"`
	AbuseReason             string `gorm:"size:160" json:"abuse_reason,omitempty"`
	PublicErrorCode         string `gorm:"size:80;index" json:"public_error_code,omitempty"`
	PublicErrorMessage      string `gorm:"size:240" json:"public_error_message,omitempty"`
	InternalErrorCode       string `gorm:"size:100;index" json:"internal_error_code,omitempty"`
	InternalErrorMessage    string `gorm:"type:text" json:"-"`
	RouterStatus            int    `gorm:"not null;default:0" json:"router_status"`
	RouterLatencyMS         int64  `gorm:"not null;default:0" json:"router_latency_ms"`
	RouterCorrelationID     string `gorm:"size:120" json:"router_correlation_id,omitempty"`
	ClientIPHash            string `gorm:"size:128" json:"-"`
	UserAgentHash           string `gorm:"size:128" json:"-"`
	ConcurrencySlotAcquired bool   `gorm:"not null;default:false" json:"-"`

	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (r *DigiConnectRequest) BeforeCreate(_ *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

type DigiConnectUsageCounter struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	UserID    uuid.UUID  `gorm:"type:uuid;not null;index;uniqueIndex:idx_digiconnect_usage_window" json:"user_id"`
	APIKeyID  *uuid.UUID `gorm:"type:uuid;index;uniqueIndex:idx_digiconnect_usage_window" json:"api_key_id,omitempty"`
	Scope     string     `gorm:"size:40;not null;uniqueIndex:idx_digiconnect_usage_window" json:"scope"`
	Window    string     `gorm:"size:40;not null;uniqueIndex:idx_digiconnect_usage_window" json:"window"`
	Count     int64      `gorm:"not null;default:0" json:"count"`
	ResetAt   time.Time  `gorm:"not null;index" json:"reset_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (c *DigiConnectUsageCounter) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
