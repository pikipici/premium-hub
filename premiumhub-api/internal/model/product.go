package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Product struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Slug        string         `gorm:"size:100;uniqueIndex;not null" json:"slug"`
	Category    string         `gorm:"size:50;not null" json:"category"`
	Description string         `gorm:"type:text" json:"description"`
	Icon        string         `gorm:"size:10" json:"icon"`
	Color       string         `gorm:"size:30" json:"color"`
	IsPopular   bool           `gorm:"default:false" json:"is_popular"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	Prices      []ProductPrice `gorm:"foreignKey:ProductID" json:"prices,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type ProductPrice struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID   uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Duration    int       `gorm:"not null" json:"duration"`
	AccountType string    `gorm:"size:20;not null" json:"account_type"`
	Price       int64     `gorm:"not null" json:"price"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
}

func (p *Product) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

func (p *ProductPrice) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
