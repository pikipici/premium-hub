package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SiteFlashSale struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"product_id"`
	EndsAt    time.Time `gorm:"not null" json:"ends_at"`
	SortOrder int       `gorm:"not null;default:0" json:"sort_order"`
	IsActive  bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Product   *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (s *SiteFlashSale) BeforeCreate(_ *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
