package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductFAQItem struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type Product struct {
	ID                 uuid.UUID        `gorm:"type:uuid;primaryKey" json:"id"`
	Name               string           `gorm:"size:100;not null" json:"name"`
	Slug               string           `gorm:"size:100;uniqueIndex;not null" json:"slug"`
	Category           string           `gorm:"size:50;not null" json:"category"`
	Description        string           `gorm:"type:text" json:"description"`
	Tagline            string           `gorm:"size:180" json:"tagline"`
	Icon               string           `gorm:"size:10" json:"icon"`
	Color              string           `gorm:"size:30" json:"color"`
	BadgePopularText   string           `gorm:"size:120" json:"badge_popular_text"`
	BadgeGuaranteeText string           `gorm:"size:120" json:"badge_guarantee_text"`
	SoldText           string           `gorm:"size:120" json:"sold_text"`
	SharedNote         string           `gorm:"size:220" json:"shared_note"`
	PrivateNote        string           `gorm:"size:220" json:"private_note"`
	TrustItems         []string         `gorm:"serializer:json" json:"trust_items,omitempty"`
	FAQItems           []ProductFAQItem `gorm:"serializer:json" json:"faq_items,omitempty"`
	SeoDescription     string           `gorm:"type:text" json:"seo_description"`
	SortPriority       int              `gorm:"default:0" json:"sort_priority"`
	IsPopular          bool             `gorm:"default:false" json:"is_popular"`
	IsActive           bool             `gorm:"default:true" json:"is_active"`
	Prices             []ProductPrice   `gorm:"foreignKey:ProductID" json:"prices,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
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
