package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	ProductCategoryScopePremApps = "prem_apps"
	ProductCategoryScopeSosmed   = "sosmed"
)

type ProductCategory struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Scope       string    `gorm:"size:20;not null;index:idx_product_categories_scope_sort,priority:1;uniqueIndex:uk_product_category_scope_code,priority:1" json:"scope"`
	Code        string    `gorm:"size:50;not null;uniqueIndex:uk_product_category_scope_code,priority:2" json:"code"`
	Label       string    `gorm:"size:120;not null" json:"label"`
	Description string    `gorm:"size:220" json:"description"`
	SortOrder   int       `gorm:"default:100;index:idx_product_categories_scope_sort,priority:2" json:"sort_order"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (p *ProductCategory) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
