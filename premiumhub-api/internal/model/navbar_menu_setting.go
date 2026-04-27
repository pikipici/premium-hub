package model

import "time"

type NavbarMenuSetting struct {
	Key       string `gorm:"size:80;primaryKey" json:"key"`
	Label     string `gorm:"size:120;not null" json:"label"`
	Href      string `gorm:"size:180;not null" json:"href"`
	SortOrder int    `gorm:"not null;default:100" json:"sort_order"`
	IsVisible bool   `gorm:"not null;default:true" json:"is_visible"`
	IsSystem  bool   `gorm:"not null;default:true" json:"is_system"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
