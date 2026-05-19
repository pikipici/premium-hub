package service

import (
	"errors"
	"fmt"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/credential"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GmailOrderService handles the buy-side of the gmail marketplace.
//
// One-shot atomic Buy: lock buyer, read pricing, FIFO-claim verified
// gmail rows with SKIP LOCKED, debit spend pocket, write order +
// per-row sold marks + ledger row, all in one wallet transaction.
//
// Architectural choice: dedicated GmailOrder model + service paralel
// dengan OrderService existing (premapps/sosmed) — gak fork karena
// premapps coupling ke ProductPrice tight. Lihat
// .kiro/steering/gmail-marketplace.md Round 2 untuk reasoning.
type GmailOrderService struct {
	cfg            *config.Config
	gmailRepo      *repository.GmailAccountRepo
	orderRepo      *repository.GmailOrderRepo
	walletRepo     *repository.WalletRepo
	notifRepo      *repository.NotificationRepo
	pricingService *GmailPricingService
	cipher         *credential.StockCipher
}

func NewGmailOrderService(
	cfg *config.Config,
	gmailRepo *repository.GmailAccountRepo,
	orderRepo *repository.GmailOrderRepo,
	walletRepo *repository.WalletRepo,
	notifRepo *repository.NotificationRepo,
	pricingService *GmailPricingService,
	cipher *credential.StockCipher,
) *GmailOrderService {
	return &GmailOrderService{
		cfg:            cfg,
		gmailRepo:      gmailRepo,
		orderRepo:      orderRepo,
		walletRepo:     walletRepo,
		notifRepo:      notifRepo,
		pricingService: pricingService,
		cipher:         cipher,
	}
}

func (s *GmailOrderService) maxQtyPerOrder() int64 {
	if s.cfg != nil && s.cfg.GmailBuyMaxQtyPerOrder > 0 {
		return int64(s.cfg.GmailBuyMaxQtyPerOrder)
	}
	return 50
}

// BuyResult is the response returned by Buy() — order header plus
// decrypted credentials per claimed account (one-time view, not
// persisted plain).
type BuyResult struct {
	Order *model.GmailOrder `json:"order"`
	Items []GmailItemCreds  `json:"items"`
}

// GmailItemCreds is the per-account credential pair shown to the
// buyer right after purchase.
type GmailItemCreds struct {
	GmailAccountID uuid.UUID `json:"gmail_account_id"`
	Email          string    `json:"email"`
	Password       string    `json:"password"` // decrypted on-the-fly
}

// OrderWithCreds is the GET /gmail/orders/:id response — order
// header + per-item creds re-decrypted on each fetch.
type OrderWithCreds struct {
	Order *model.GmailOrder `json:"order"`
	Items []GmailItemCreds  `json:"items"`
}

// Buy executes a buyer's purchase atomically.
//
// All work is inside one walletRepo.Transaction:
//   1. Validate qty (1 <= qty <= max)
//   2. Lock buyer user row (FOR UPDATE) via LockUserByIDTx
//   3. Read GmailPricing in tx (admin updates can't race)
//   4. CalculateTotalTx → gross / discount / net
//   5. Verify buyer.WalletBalance >= net
//   6. LockOldestVerifiedForOrderTx(qty) — FIFO + SKIP LOCKED
//   7. If len(claimed) < qty → rollback with stock-error
//   8. Debit buyer.WalletBalance -= net
//   9. Create GmailOrder row (Quantity, amounts, Status=completed)
//  10. Mark each claimed gmail Status=sold + SoldOrderID + SoldPrice
//  11. Write WalletLedger debit row (pocket=spend, ref="gmail-order:<id>")
//  12. Write notification "Pembelian sukses, X akun"
//  13. Return order + decrypted creds (one-time view)
func (s *GmailOrderService) Buy(buyerID uuid.UUID, qty int64) (*BuyResult, error) {
	if qty < 1 {
		return nil, errors.New("quantity minimal 1")
	}
	if qty > s.maxQtyPerOrder() {
		return nil, fmt.Errorf("quantity maksimal %d per order", s.maxQtyPerOrder())
	}

	var result *BuyResult
	err := s.walletRepo.Transaction(func(tx *gorm.DB) error {
		// 1. Lock buyer user row.
		buyer, err := s.walletRepo.LockUserByIDTx(tx, buyerID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}

		// 2. Read pricing in tx + calculate.
		pricing, err := s.pricingService.GetActiveTx(tx)
		if err != nil {
			return errors.New("gagal load pricing config")
		}
		gross, discount, net, err := calcTotalFromPricing(pricing, qty)
		if err != nil {
			return err
		}

		// 3. Balance check (spend pocket = WalletBalance).
		if buyer.WalletBalance < net {
			return fmt.Errorf("saldo utama tidak cukup (perlu Rp %d, saldo Rp %d)", net, buyer.WalletBalance)
		}

		// 4. FIFO claim verified inventory.
		claimed, err := s.gmailRepo.LockOldestVerifiedForOrderTx(tx, int(qty))
		if err != nil {
			return errors.New("gagal claim inventory")
		}
		if int64(len(claimed)) < qty {
			return fmt.Errorf("stok cuma %d, kurangi quantity", len(claimed))
		}

		// 5. Snapshot pricing tier for the order receipt.
		tierPct := 0
		if discount > 0 && gross > 0 {
			// Reverse-derive tier pct from actual discount/gross — accounts
			// for integer division noise from CalculateTotal.
			tierPct = int(discount * 100 / gross)
		}
		// UnitPrice on receipt = the pre-discount sell_price snapshot,
		// not net/qty — buyer expects to see the per-unit list price.
		unitPrice := pricing.SellPrice

		now := time.Now()

		// 6. Debit buyer balance.
		balanceBefore := buyer.WalletBalance
		balanceAfter := balanceBefore - net
		buyer.WalletBalance = balanceAfter
		if err := s.walletRepo.SaveUserTx(tx, buyer); err != nil {
			return errors.New("gagal update saldo utama")
		}

		// 7. Create order row first to get its ID.
		order := &model.GmailOrder{
			ID:              uuid.New(),
			UserID:          buyerID,
			Quantity:        qty,
			UnitPrice:       unitPrice,
			GrossAmount:     gross,
			DiscountAmount:  discount,
			DiscountTierPct: tierPct,
			NetAmount:       net,
			Status:          model.GmailOrderStatusCompleted,
		}
		if err := s.orderRepo.CreateTx(tx, order); err != nil {
			return errors.New("gagal create order")
		}

		// 8. Mark each gmail row sold + chain to order.
		// SoldPrice = the per-unit price after applying tier discount,
		// rounded down (integer division). Sum of SoldPrice may be off
		// by ≤ qty-1 from net due to rounding; the order row carries
		// the canonical NetAmount for accounting.
		soldPricePerUnit := net / qty
		for i := range claimed {
			row := &claimed[i]
			row.Status = model.GmailStatusSold
			row.SoldToUserID = &buyerID
			row.SoldOrderID = &order.ID
			row.SoldPrice = soldPricePerUnit
			row.SoldAt = &now
			if err := s.gmailRepo.SaveTx(tx, row); err != nil {
				return errors.New("gagal mark sold")
			}
		}

		// 9. Write debit ledger row.
		ref := fmt.Sprintf("gmail-order:%s", order.ID.String())
		ledger := &model.WalletLedger{
			ID:            uuid.New(),
			UserID:        buyerID,
			Type:          "debit",
			Category:      model.LedgerCategoryGmailBuyDebit,
			Pocket:        model.WalletPocketSpend,
			Amount:        net,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceAfter,
			Reference:     ref,
			Description:   fmt.Sprintf("Pembelian %d akun gmail", qty),
		}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger debit")
		}
		order.DebitLedgerID = &ledger.ID
		if err := s.orderRepo.SaveTx(tx, order); err != nil {
			return errors.New("gagal stamp ledger id")
		}

		// 10. Notif buyer.
		_ = s.writeBuyerNotifTx(tx, buyerID,
			"Pembelian Gmail Sukses",
			fmt.Sprintf("Lu beli %d akun gmail (total Rp %d). Lihat kredensial di order detail.", qty, net))

		// 11. Build response with decrypted creds.
		items := make([]GmailItemCreds, 0, len(claimed))
		for _, c := range claimed {
			pw, derr := s.cipher.Decrypt(c.PasswordEnc)
			if derr != nil {
				// One bad decrypt = unfulfillable order. Fail loud so
				// admin investigates instead of half-delivering.
				return errors.New("gagal dekripsi password (admin investigate)")
			}
			items = append(items, GmailItemCreds{
				GmailAccountID: c.ID,
				Email:          c.Email,
				Password:       pw,
			})
		}
		result = &BuyResult{
			Order: order,
			Items: items,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// ListMyOrders returns paginated buyer history.
func (s *GmailOrderService) ListMyOrders(buyerID uuid.UUID, page, limit int) ([]model.GmailOrder, int64, error) {
	return s.orderRepo.ListByUser(buyerID, page, limit)
}

// GetMyOrderWithCreds returns one order + decrypted creds per item.
// Auth-scoped: returns ErrRecordNotFound if order doesn't belong to
// userID.
func (s *GmailOrderService) GetMyOrderWithCreds(buyerID, orderID uuid.UUID) (*OrderWithCreds, error) {
	order, err := s.orderRepo.GetByIDForUserWithItems(orderID, buyerID)
	if err != nil {
		return nil, err
	}
	items := make([]GmailItemCreds, 0, len(order.Items))
	for _, c := range order.Items {
		pw, err := s.cipher.Decrypt(c.PasswordEnc)
		if err != nil {
			return nil, errors.New("gagal dekripsi salah satu password")
		}
		items = append(items, GmailItemCreds{
			GmailAccountID: c.ID,
			Email:          c.Email,
			Password:       pw,
		})
	}
	return &OrderWithCreds{
		Order: order,
		Items: items,
	}, nil
}

// ----- internals -----

// writeBuyerNotifTx mirrors the WD/Gmail-sell pattern — atomic notif
// inside the same tx as the state change. Type prefix gmail_ for
// dashboard filtering.
func (s *GmailOrderService) writeBuyerNotifTx(tx *gorm.DB, userID uuid.UUID, title, message string) error {
	notif := &model.Notification{
		UserID:  userID,
		Title:   title,
		Message: message,
		Type:    "gmail_purchased",
	}
	if err := tx.Create(notif).Error; err != nil {
		return errors.New("gagal membuat notifikasi")
	}
	return nil
}
