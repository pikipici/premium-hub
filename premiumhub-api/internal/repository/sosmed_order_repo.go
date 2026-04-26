package repository

import (
	"strings"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SosmedOrderRepo struct {
	db *gorm.DB
}

type SosmedOrderOpsSummary struct {
	Total                  int64 `json:"total"`
	PendingPayment         int64 `json:"pending_payment"`
	Processing             int64 `json:"processing"`
	Success                int64 `json:"success"`
	Failed                 int64 `json:"failed"`
	Retryable              int64 `json:"retryable"`
	Syncable               int64 `json:"syncable"`
	StaleSync              int64 `json:"stale_sync"`
	MissingProviderOrderID int64 `json:"missing_provider_order_id"`
	ProviderErrors         int64 `json:"provider_errors"`
	StaleSyncMinutes       int   `json:"stale_sync_minutes"`
}

func NewSosmedOrderRepo(db *gorm.DB) *SosmedOrderRepo {
	return &SosmedOrderRepo{db: db}
}

func (r *SosmedOrderRepo) Create(order *model.SosmedOrder) error {
	return r.db.Create(order).Error
}

func (r *SosmedOrderRepo) Update(order *model.SosmedOrder) error {
	return r.db.Save(order).Error
}

func (r *SosmedOrderRepo) FindByID(id uuid.UUID) (*model.SosmedOrder, error) {
	var order model.SosmedOrder
	err := r.db.Preload("User").Preload("Service").First(&order, "id = ?", id).Error
	return &order, err
}

func (r *SosmedOrderRepo) FindByGatewayOrderID(gatewayOrderID string) (*model.SosmedOrder, error) {
	var order model.SosmedOrder
	err := r.db.Where("gateway_order_id = ?", gatewayOrderID).First(&order).Error
	return &order, err
}

func (r *SosmedOrderRepo) FindByUserID(userID uuid.UUID, page, limit int) ([]model.SosmedOrder, int64, error) {
	var orders []model.SosmedOrder
	var total int64

	q := r.db.Model(&model.SosmedOrder{}).Where("user_id = ?", userID)
	q.Count(&total)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}

	err := q.Preload("Service").
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedOrderRepo) AdminList(status string, page, limit int) ([]model.SosmedOrder, int64, error) {
	var orders []model.SosmedOrder
	var total int64

	q := r.db.Model(&model.SosmedOrder{})
	if status != "" {
		q = q.Where("order_status = ?", status)
	}
	q.Count(&total)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	err := q.Preload("User").Preload("Service").
		Offset((page - 1) * limit).
		Limit(limit).
		Order("created_at DESC").
		Find(&orders).Error
	return orders, total, err
}

func (r *SosmedOrderRepo) FindSyncableProviderOrders(providerCode string, limit int) ([]model.SosmedOrder, error) {
	var orders []model.SosmedOrder

	q := r.db.Model(&model.SosmedOrder{}).
		Where("provider_code = ?", strings.TrimSpace(providerCode)).
		Where("provider_order_id IS NOT NULL AND provider_order_id <> ''").
		Where("payment_status = ?", "paid").
		Where("order_status = ?", "processing").
		Order("updated_at ASC")

	if limit > 0 {
		q = q.Limit(limit)
	}

	err := q.Find(&orders).Error
	return orders, err
}

func (r *SosmedOrderRepo) AdminOpsSummary(staleBefore time.Time) (*SosmedOrderOpsSummary, error) {
	summary := &SosmedOrderOpsSummary{}
	count := func(dest *int64, scope func(*gorm.DB) *gorm.DB) error {
		q := r.db.Model(&model.SosmedOrder{})
		if scope != nil {
			q = scope(q)
		}
		return q.Count(dest).Error
	}
	japOrders := func(q *gorm.DB) *gorm.DB {
		return q.Where("provider_code = ?", "jap")
	}
	processingJAPOrders := func(q *gorm.DB) *gorm.DB {
		return japOrders(q).
			Where("payment_status = ?", "paid").
			Where("order_status = ?", "processing")
	}
	hasProviderOrderID := func(q *gorm.DB) *gorm.DB {
		return q.Where("provider_order_id IS NOT NULL AND provider_order_id <> ''")
	}
	missingProviderOrderID := func(q *gorm.DB) *gorm.DB {
		return q.Where("(provider_order_id IS NULL OR provider_order_id = '')")
	}

	scopes := []struct {
		dest  *int64
		scope func(*gorm.DB) *gorm.DB
	}{
		{&summary.Total, nil},
		{&summary.PendingPayment, func(q *gorm.DB) *gorm.DB {
			return q.Where("order_status = ?", "pending_payment")
		}},
		{&summary.Processing, func(q *gorm.DB) *gorm.DB {
			return q.Where("order_status = ?", "processing")
		}},
		{&summary.Success, func(q *gorm.DB) *gorm.DB {
			return q.Where("order_status = ?", "success")
		}},
		{&summary.Failed, func(q *gorm.DB) *gorm.DB {
			return q.Where("order_status = ?", "failed")
		}},
		{&summary.Retryable, func(q *gorm.DB) *gorm.DB {
			return missingProviderOrderID(japOrders(q)).
				Where("payment_method = ?", "wallet").
				Where("order_status = ?", "failed")
		}},
		{&summary.Syncable, func(q *gorm.DB) *gorm.DB {
			return hasProviderOrderID(processingJAPOrders(q))
		}},
		{&summary.StaleSync, func(q *gorm.DB) *gorm.DB {
			return hasProviderOrderID(processingJAPOrders(q)).
				Where("(provider_synced_at IS NULL OR provider_synced_at < ?)", staleBefore)
		}},
		{&summary.MissingProviderOrderID, func(q *gorm.DB) *gorm.DB {
			return missingProviderOrderID(processingJAPOrders(q))
		}},
		{&summary.ProviderErrors, func(q *gorm.DB) *gorm.DB {
			return q.Where("provider_error IS NOT NULL AND provider_error <> ''")
		}},
	}

	for _, item := range scopes {
		if err := count(item.dest, item.scope); err != nil {
			return nil, err
		}
	}

	return summary, nil
}

func (r *SosmedOrderRepo) CreateEvent(event *model.SosmedOrderEvent) error {
	return r.db.Create(event).Error
}

func (r *SosmedOrderRepo) ListEventsByOrder(orderID uuid.UUID) ([]model.SosmedOrderEvent, error) {
	var events []model.SosmedOrderEvent
	err := r.db.Model(&model.SosmedOrderEvent{}).
		Where("order_id = ?", orderID).
		Order("created_at ASC").
		Find(&events).Error
	return events, err
}
