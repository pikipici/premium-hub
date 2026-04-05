package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Claim struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null" json:"user_id"`
	OrderID       uuid.UUID  `gorm:"type:uuid;not null" json:"order_id"`
	Reason        string     `gorm:"size:50;not null" json:"reason"`
	Description   string     `gorm:"type:text;not null" json:"description"`
	ScreenshotURL string     `gorm:"size:255" json:"screenshot_url"`
	Status        string     `gorm:"size:20;default:pending" json:"status"`
	AdminNote     string     `gorm:"type:text" json:"admin_note"`
	NewStockID    *uuid.UUID `gorm:"type:uuid" json:"new_stock_id"`
	ResolvedAt    *time.Time `json:"resolved_at"`
	User          User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Order         Order      `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (c *Claim) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
