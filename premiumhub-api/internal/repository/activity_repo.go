package repository

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ActivityRepo struct {
	db *gorm.DB
}

type UserActivityRow struct {
	SourceID      string    `gorm:"column:source_id"`
	OccurredAt    time.Time `gorm:"column:occurred_at"`
	Source        string    `gorm:"column:source"`
	Title         string    `gorm:"column:title"`
	Icon          string    `gorm:"column:icon"`
	DurationMonth int       `gorm:"column:duration_month"`
	AccountType   string    `gorm:"column:account_type"`
	Amount        int64     `gorm:"column:amount"`
	Direction     string    `gorm:"column:direction"`
	Status        string    `gorm:"column:status"`
	PaymentStatus string    `gorm:"column:payment_status"`
	Reference     string    `gorm:"column:reference"`
}

func NewActivityRepo(db *gorm.DB) *ActivityRepo {
	return &ActivityRepo{db: db}
}

func (r *ActivityRepo) ListByUser(userID uuid.UUID, page, limit int) ([]UserActivityRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	const listQuery = `
SELECT
	source_id,
	occurred_at,
	source,
	title,
	icon,
	duration_month,
	account_type,
	amount,
	direction,
	status,
	payment_status,
	reference
FROM (
	SELECT
		CAST(o.id AS TEXT) AS source_id,
		o.created_at AS occurred_at,
		'premium_apps' AS source,
		COALESCE(NULLIF(p.name, ''), 'Produk Premium') AS title,
		COALESCE(NULLIF(p.icon, ''), '📦') AS icon,
		COALESCE(pp.duration, 0) AS duration_month,
		COALESCE(pp.account_type, '') AS account_type,
		o.total_price AS amount,
		'debit' AS direction,
		COALESCE(o.order_status, 'pending') AS status,
		COALESCE(o.payment_status, 'pending') AS payment_status,
		'' AS reference
	FROM orders o
	LEFT JOIN product_prices pp ON pp.id = o.price_id
	LEFT JOIN products p ON p.id = pp.product_id
	WHERE o.user_id = ?

	UNION ALL

	SELECT
		CAST(wl.id AS TEXT) AS source_id,
		wl.created_at AS occurred_at,
		'nokos' AS source,
		CASE
			WHEN wl.category = '5sim_refund' THEN 'Refund Nomor Virtual'
			ELSE 'Pembelian Nomor Virtual'
		END AS title,
		'📱' AS icon,
		0 AS duration_month,
		'' AS account_type,
		wl.amount AS amount,
		CASE
			WHEN wl.category = '5sim_refund' THEN 'credit'
			ELSE 'debit'
		END AS direction,
		CASE
			WHEN wl.category = '5sim_refund' THEN 'refund'
			ELSE 'purchase'
		END AS status,
		'' AS payment_status,
		COALESCE(wl.reference, '') AS reference
	FROM wallet_ledgers wl
	WHERE wl.user_id = ?
		AND wl.category IN ('5sim_purchase', '5sim_refund')
) AS combined
ORDER BY occurred_at DESC, source_id DESC
LIMIT ? OFFSET ?`

	rows := make([]UserActivityRow, 0)
	if err := r.db.Raw(listQuery, userID, userID, limit, offset).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	const countQuery = `
SELECT
	COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = ?), 0)
	+
	COALESCE((SELECT COUNT(*) FROM wallet_ledgers WHERE user_id = ? AND category IN ('5sim_purchase', '5sim_refund')), 0)
	AS total`

	var countRow struct {
		Total int64 `gorm:"column:total"`
	}
	if err := r.db.Raw(countQuery, userID, userID).Scan(&countRow).Error; err != nil {
		return nil, 0, err
	}

	return rows, countRow.Total, nil
}
