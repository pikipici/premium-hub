package config

import (
	"fmt"

	"premiumhub-api/internal/model"

	"gorm.io/gorm"
)

func applyPaymentSchemaCleanup(db *gorm.DB) error {
	if db == nil {
		return nil
	}

	if db.Migrator().HasTable("orders") {
		if !db.Migrator().HasColumn(&model.Order{}, "GatewayOrderID") {
			if err := db.Migrator().AddColumn(&model.Order{}, "GatewayOrderID"); err != nil {
				return fmt.Errorf("add orders.gateway_order_id: %w", err)
			}
		}
		if !db.Migrator().HasColumn(&model.Order{}, "PaymentPayload") {
			if err := db.Migrator().AddColumn(&model.Order{}, "PaymentPayload"); err != nil {
				return fmt.Errorf("add orders.payment_payload: %w", err)
			}
		}

		if db.Migrator().HasColumn("orders", "midtrans_id") {
			if err := db.Exec(`
UPDATE orders
SET gateway_order_id = midtrans_id
WHERE (gateway_order_id IS NULL OR gateway_order_id = '')
  AND midtrans_id IS NOT NULL
  AND midtrans_id <> ''
`).Error; err != nil {
				return fmt.Errorf("backfill orders.gateway_order_id: %w", err)
			}
		}

		if db.Migrator().HasColumn("orders", "snap_token") {
			if err := db.Exec(`
UPDATE orders
SET payment_payload = snap_token
WHERE (payment_payload IS NULL OR payment_payload = '')
  AND snap_token IS NOT NULL
  AND snap_token <> ''
`).Error; err != nil {
				return fmt.Errorf("backfill orders.payment_payload: %w", err)
			}
		}
	}

	if db.Migrator().HasTable("wallet_topups") {
		if !db.Migrator().HasColumn(&model.WalletTopup{}, "GatewayRef") {
			if err := db.Migrator().AddColumn(&model.WalletTopup{}, "GatewayRef"); err != nil {
				return fmt.Errorf("add wallet_topups.gateway_ref: %w", err)
			}
		}

		if db.Migrator().HasColumn("wallet_topups", "provider_trx_id") {
			if err := db.Exec(`
UPDATE wallet_topups
SET gateway_ref = provider_trx_id
WHERE (gateway_ref IS NULL OR gateway_ref = '')
  AND provider_trx_id IS NOT NULL
  AND provider_trx_id <> ''
`).Error; err != nil {
				return fmt.Errorf("backfill wallet_topups.gateway_ref: %w", err)
			}
		}
	}

	return nil
}
