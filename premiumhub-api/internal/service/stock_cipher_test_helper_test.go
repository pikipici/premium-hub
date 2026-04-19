package service

import (
	"testing"

	"premiumhub-api/pkg/credential"
)

func mustTestStockCipher(t *testing.T) *credential.StockCipher {
	t.Helper()

	cipher, err := credential.NewStockCipher("test-stock-credential-key")
	if err != nil {
		t.Fatalf("init test stock cipher: %v", err)
	}

	return cipher
}
