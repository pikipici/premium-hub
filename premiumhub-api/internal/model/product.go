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

type ProductSpecItem struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type ProductTrustBadge struct {
	Icon string `json:"icon"`
	Text string `json:"text"`
}

type Product struct {
	ID                 uuid.UUID           `gorm:"type:uuid;primaryKey" json:"id"`
	Name               string              `gorm:"size:100;not null" json:"name"`
	Slug               string              `gorm:"size:100;uniqueIndex;not null" json:"slug"`
	Category           string              `gorm:"size:50;not null" json:"category"`
	Description        string              `gorm:"type:text" json:"description"`
	Tagline            string              `gorm:"size:180" json:"tagline"`
	Icon               string              `gorm:"size:10" json:"icon"`
	IconImageURL       string              `gorm:"size:500" json:"icon_image_url"`
	Color              string              `gorm:"size:30" json:"color"`
	HeroBgURL          string              `gorm:"size:500" json:"hero_bg_url"`
	BadgePopularText   string              `gorm:"size:120" json:"badge_popular_text"`
	BadgeGuaranteeText string              `gorm:"size:120" json:"badge_guarantee_text"`
	SoldText           string              `gorm:"size:120" json:"sold_text"`
	SharedNote         string              `gorm:"size:220" json:"shared_note"`
	PrivateNote        string              `gorm:"size:220" json:"private_note"`
	FeatureItems       []string            `gorm:"serializer:json" json:"feature_items,omitempty"`
	SpecItems          []ProductSpecItem   `gorm:"serializer:json" json:"spec_items,omitempty"`
	TrustItems         []string            `gorm:"serializer:json" json:"trust_items,omitempty"`
	TrustBadges        []ProductTrustBadge `gorm:"serializer:json" json:"trust_badges,omitempty"`
	FAQItems           []ProductFAQItem    `gorm:"serializer:json" json:"faq_items,omitempty"`
	PriceOriginalText  string              `gorm:"size:80" json:"price_original_text"`
	PricePerDayText    string              `gorm:"size:120" json:"price_per_day_text"`
	DiscountBadgeText  string              `gorm:"size:120" json:"discount_badge_text"`
	ShowWhatsAppButton bool                `gorm:"default:true" json:"show_whatsapp_button"`
	WhatsAppNumber     string              `gorm:"size:30" json:"whatsapp_number"`
	WhatsAppButtonText string              `gorm:"size:100" json:"whatsapp_button_text"`
	SeoDescription     string              `gorm:"type:text" json:"seo_description"`
	SortPriority       int                 `gorm:"default:0" json:"sort_priority"`
	IsPopular          bool                `gorm:"default:false" json:"is_popular"`
	IsActive           bool                `gorm:"default:true" json:"is_active"`
	AvailableStock     int64               `gorm:"-" json:"available_stock"`
	Prices             []ProductPrice      `gorm:"foreignKey:ProductID" json:"prices,omitempty"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
}

type ProductPrice struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID   uuid.UUID `gorm:"type:uuid;not null" json:"product_id"`
	Duration    int       `gorm:"not null" json:"duration"`
	AccountType string    `gorm:"size:20;not null" json:"account_type"`
	Label       string    `gorm:"size:80" json:"label"`
	SavingsText string    `gorm:"size:120" json:"savings_text"`
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
