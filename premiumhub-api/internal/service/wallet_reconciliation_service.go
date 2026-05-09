package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WalletReconciliationService struct {
	walletRepo *repository.WalletRepo
}

func NewWalletReconciliationService(walletRepo *repository.WalletRepo) *WalletReconciliationService {
	return &WalletReconciliationService{walletRepo: walletRepo}
}

type WalletReconciliationFilter struct {
	From    *time.Time
	To      *time.Time
	UserID  *uuid.UUID
	OrderID *uuid.UUID
	Limit   int
}

type WalletReconciliationIssue struct {
	Key           string    `json:"key"`
	Type          string    `json:"type"`
	Severity      string    `json:"severity"`
	OrderID       string    `json:"order_id"`
	UserID        string    `json:"user_id"`
	PaymentStatus string    `json:"payment_status"`
	OrderStatus   string    `json:"order_status"`
	Amount        int64     `json:"amount"`
	ExpectedRef   string    `json:"expected_ref,omitempty"`
	LedgerRefs    []string  `json:"ledger_refs,omitempty"`
	Description   string    `json:"description"`
	Repairable    bool      `json:"repairable"`
	RepairAction  string    `json:"repair_action,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type WalletReconciliationSummary struct {
	TotalIssues           int `json:"total_issues"`
	PaidMissingDebit      int `json:"paid_missing_debit"`
	TerminalMissingRefund int `json:"terminal_missing_refund"`
	DuplicateRefund       int `json:"duplicate_refund"`
	PaymentOrderMismatch  int `json:"payment_order_mismatch"`
}

type WalletReconciliationReport struct {
	Summary WalletReconciliationSummary    `json:"summary"`
	Issues  []WalletReconciliationIssue    `json:"issues"`
	Filters WalletReconciliationFilterInfo `json:"filters"`
}

type WalletReconciliationFilterInfo struct {
	From    string `json:"from,omitempty"`
	To      string `json:"to,omitempty"`
	UserID  string `json:"user_id,omitempty"`
	OrderID string `json:"order_id,omitempty"`
	Limit   int    `json:"limit"`
}

type WalletReconciliationRepairResult struct {
	Repaired bool   `json:"repaired"`
	IssueKey string `json:"issue_key"`
	Action   string `json:"action"`
	LedgerID string `json:"ledger_id,omitempty"`
	Message  string `json:"message"`
}

func (s *WalletReconciliationService) Report(filter WalletReconciliationFilter) (*WalletReconciliationReport, error) {
	if s == nil || s.walletRepo == nil {
		return nil, errors.New("wallet reconciliation belum siap")
	}
	if filter.Limit <= 0 {
		filter.Limit = 200
	}
	if filter.Limit > 1000 {
		filter.Limit = 1000
	}

	db := s.walletRepo.DB()
	q := db.Model(&model.SosmedOrder{}).Where("payment_method = ?", "wallet")
	if filter.From != nil {
		q = q.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		q = q.Where("created_at <= ?", *filter.To)
	}
	if filter.UserID != nil {
		q = q.Where("user_id = ?", *filter.UserID)
	}
	if filter.OrderID != nil {
		q = q.Where("id = ?", *filter.OrderID)
	}

	var orders []model.SosmedOrder
	if err := q.Order("created_at DESC").Limit(filter.Limit).Find(&orders).Error; err != nil {
		return nil, errors.New("gagal memuat order wallet")
	}

	issues := make([]WalletReconciliationIssue, 0)
	for idx := range orders {
		order := orders[idx]
		chargeRefs, refundRefs, err := s.orderLedgerRefs(db, order.ID, order.UserID)
		if err != nil {
			return nil, err
		}
		chargeRef := sosmedOrderWalletChargeRef(order.ID)
		refundRef := sosmedOrderWalletRefundRef(order.ID)
		status := normalizeSosmedOrderStatus(order.OrderStatus)

		if order.PaymentStatus == "paid" && len(chargeRefs) == 0 {
			issues = append(issues, buildWalletReconIssue(order, "paid_missing_debit", "critical", chargeRef, nil, "Order wallet paid tapi ledger debit pembelian tidak ada.", false, ""))
		}
		if order.PaymentStatus == "paid" && isWalletRefundableTerminalSosmedOrderStatus(status) && len(refundRefs) == 0 && len(chargeRefs) > 0 {
			issues = append(issues, buildWalletReconIssue(order, "terminal_missing_refund", "critical", refundRef, chargeRefs, "Order terminal failed/canceled tapi refund wallet belum ada.", true, "create_missing_refund"))
		}
		if len(refundRefs) > 1 {
			issues = append(issues, buildWalletReconIssue(order, "duplicate_refund", "critical", refundRef, refundRefs, "Order punya lebih dari satu ledger refund; perlu audit manual sebelum koreksi saldo.", false, ""))
		}
		if isPaymentOrderStatusMismatch(order.PaymentStatus, status, len(refundRefs) > 0) {
			issues = append(issues, buildWalletReconIssue(order, "payment_order_mismatch", "warning", "", append(chargeRefs, refundRefs...), "payment_status tidak konsisten dengan order_status dan state refund.", false, ""))
		}
	}

	report := &WalletReconciliationReport{Issues: issues, Filters: filter.toInfo()}
	for _, issue := range issues {
		report.Summary.TotalIssues++
		switch issue.Type {
		case "paid_missing_debit":
			report.Summary.PaidMissingDebit++
		case "terminal_missing_refund":
			report.Summary.TerminalMissingRefund++
		case "duplicate_refund":
			report.Summary.DuplicateRefund++
		case "payment_order_mismatch":
			report.Summary.PaymentOrderMismatch++
		}
	}
	return report, nil
}

func (s *WalletReconciliationService) Repair(issueKey, action string, actorID uuid.UUID) (*WalletReconciliationRepairResult, error) {
	parts := strings.Split(strings.TrimSpace(issueKey), ":")
	if len(parts) != 2 || parts[0] != "terminal_missing_refund" {
		return nil, errors.New("issue tidak repairable otomatis")
	}
	if action != "create_missing_refund" {
		return nil, errors.New("aksi repair tidak valid")
	}
	orderID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, errors.New("issue key tidak valid")
	}

	result := &WalletReconciliationRepairResult{IssueKey: issueKey, Action: action}
	err = s.walletRepo.Transaction(func(tx *gorm.DB) error {
		var order model.SosmedOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, "id = ?", orderID).Error; err != nil {
			return errors.New("order sosmed tidak ditemukan")
		}
		if !strings.EqualFold(order.PaymentMethod, "wallet") || order.PaymentStatus != "paid" || !isWalletRefundableTerminalSosmedOrderStatus(order.OrderStatus) {
			return errors.New("order tidak aman untuk refund otomatis")
		}
		charge, err := s.walletRepo.FindLedgerByReferenceTx(tx, sosmedOrderWalletChargeRef(order.ID))
		if err != nil {
			return errors.New("ledger debit tidak ditemukan")
		}
		if err := validateSosmedWalletChargeLedger(&order, charge); err != nil {
			return err
		}
		refundRef := sosmedOrderWalletRefundRef(order.ID)
		if _, err := s.walletRepo.FindLedgerByReferenceTx(tx, refundRef); err == nil {
			result.Message = "Refund sudah ada, repair dilewati."
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("gagal cek ledger refund")
		}
		user, err := s.walletRepo.LockUserByIDTx(tx, order.UserID)
		if err != nil {
			return errors.New("user tidak ditemukan")
		}
		before := user.WalletBalance
		after := before + charge.Amount
		user.WalletBalance = after
		if err := s.walletRepo.SaveUserTx(tx, user); err != nil {
			return errors.New("gagal update saldo wallet")
		}
		ledger := &model.WalletLedger{ID: uuid.New(), UserID: user.ID, Type: "credit", Category: "sosmed_refund", Amount: charge.Amount, BalanceBefore: before, BalanceAfter: after, Reference: refundRef, Description: fmt.Sprintf("Repair refund wallet order sosmed %s oleh admin %s", shortSosmedWalletRef(order.ID.String()), shortSosmedWalletRef(actorID.String()))}
		if err := s.walletRepo.CreateLedgerTx(tx, ledger); err != nil {
			return errors.New("gagal menulis ledger refund")
		}
		order.PaymentStatus = "failed"
		if err := tx.Save(&order).Error; err != nil {
			return errors.New("gagal update payment status order")
		}
		result.Repaired = true
		result.LedgerID = ledger.ID.String()
		result.Message = "Refund wallet dibuat dan payment_status ditandai failed."
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *WalletReconciliationService) orderLedgerRefs(db *gorm.DB, orderID, userID uuid.UUID) ([]string, []string, error) {
	pattern := fmt.Sprintf("sosmed_order:%s:%%", orderID.String())
	var ledgers []model.WalletLedger
	if err := db.Where("user_id = ? AND reference LIKE ?", userID, pattern).Find(&ledgers).Error; err != nil {
		return nil, nil, errors.New("gagal memuat ledger wallet")
	}
	chargeRefs := make([]string, 0)
	refundRefs := make([]string, 0)
	for _, ledger := range ledgers {
		if ledger.Type == "debit" && ledger.Category == "sosmed_purchase" && strings.HasSuffix(ledger.Reference, ":charge") {
			chargeRefs = append(chargeRefs, ledger.Reference)
		}
		if ledger.Type == "credit" && ledger.Category == "sosmed_refund" && strings.HasSuffix(ledger.Reference, ":refund") {
			refundRefs = append(refundRefs, ledger.Reference)
		}
	}
	return chargeRefs, refundRefs, nil
}

func buildWalletReconIssue(order model.SosmedOrder, issueType, severity, expectedRef string, ledgerRefs []string, description string, repairable bool, action string) WalletReconciliationIssue {
	return WalletReconciliationIssue{Key: fmt.Sprintf("%s:%s", issueType, order.ID.String()), Type: issueType, Severity: severity, OrderID: order.ID.String(), UserID: order.UserID.String(), PaymentStatus: order.PaymentStatus, OrderStatus: order.OrderStatus, Amount: order.TotalPrice, ExpectedRef: expectedRef, LedgerRefs: ledgerRefs, Description: description, Repairable: repairable, RepairAction: action, CreatedAt: order.CreatedAt}
}

func isPaymentOrderStatusMismatch(paymentStatus, orderStatus string, refunded bool) bool {
	paymentStatus = strings.TrimSpace(strings.ToLower(paymentStatus))
	orderStatus = normalizeSosmedOrderStatus(orderStatus)
	if paymentStatus == "paid" && orderStatus == sosmedOrderStatusPendingPayment {
		return true
	}
	if paymentStatus == "pending" && orderStatus != sosmedOrderStatusPendingPayment {
		return true
	}
	if paymentStatus == "paid" && isWalletRefundableTerminalSosmedOrderStatus(orderStatus) && refunded {
		return true
	}
	return false
}

func (f WalletReconciliationFilter) toInfo() WalletReconciliationFilterInfo {
	info := WalletReconciliationFilterInfo{Limit: f.Limit}
	if f.From != nil {
		info.From = f.From.Format(time.RFC3339)
	}
	if f.To != nil {
		info.To = f.To.Format(time.RFC3339)
	}
	if f.UserID != nil {
		info.UserID = f.UserID.String()
	}
	if f.OrderID != nil {
		info.OrderID = f.OrderID.String()
	}
	return info
}
