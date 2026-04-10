package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupCoreDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	err = db.AutoMigrate(
		&model.User{},
		&model.Product{},
		&model.ProductPrice{},
		&model.Stock{},
		&model.Order{},
		&model.Claim{},
		&model.Notification{},
		&model.WalletTopup{},
		&model.WalletLedger{},
	)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}

	return db
}

func seedUser(t *testing.T, db *gorm.DB, email string, active bool) *model.User {
	t.Helper()

	pw, err := hash.Password("secret123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	u := &model.User{
		ID:       uuid.New(),
		Name:     "User " + strings.Split(email, "@")[0],
		Email:    email,
		Password: pw,
		Role:     "user",
		IsActive: active,
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u
}

func seedProductAndPrice(t *testing.T, db *gorm.DB, name, category, accountType string, price int64, duration int) (*model.Product, *model.ProductPrice) {
	t.Helper()

	p := &model.Product{
		Name:      name,
		Slug:      strings.ToLower(strings.ReplaceAll(name, " ", "-")) + "-" + uuid.NewString()[:6],
		Category:  category,
		IsActive:  true,
		IsPopular: true,
	}
	if err := db.Create(p).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	pr := &model.ProductPrice{
		ProductID:   p.ID,
		Duration:    duration,
		AccountType: accountType,
		Price:       price,
		IsActive:    true,
	}
	if err := db.Create(pr).Error; err != nil {
		t.Fatalf("create price: %v", err)
	}

	return p, pr
}

func seedStock(t *testing.T, db *gorm.DB, productID uuid.UUID, accountType, status string) *model.Stock {
	t.Helper()
	pw, err := hash.Password("accpass123")
	if err != nil {
		t.Fatalf("hash stock password: %v", err)
	}

	s := &model.Stock{
		ProductID:   productID,
		AccountType: accountType,
		Email:       fmt.Sprintf("%s-%s@example.com", accountType, uuid.NewString()[:8]),
		Password:    pw,
		ProfileName: "profile",
		Status:      status,
	}
	if err := db.Create(s).Error; err != nil {
		t.Fatalf("create stock: %v", err)
	}
	return s
}

func seedOrder(t *testing.T, db *gorm.DB, userID, priceID uuid.UUID, status string, total int64) *model.Order {
	t.Helper()

	o := &model.Order{
		UserID:        userID,
		PriceID:       priceID,
		TotalPrice:    total,
		PaymentStatus: status,
		OrderStatus:   status,
	}
	if err := db.Create(o).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	return o
}

func seedClaim(t *testing.T, db *gorm.DB, userID, orderID uuid.UUID, status string) *model.Claim {
	t.Helper()
	c := &model.Claim{
		UserID:      userID,
		OrderID:     orderID,
		Reason:      "akun rusak",
		Description: "tidak bisa login",
		Status:      status,
	}
	if err := db.Create(c).Error; err != nil {
		t.Fatalf("create claim: %v", err)
	}
	return c
}

func registerUpdateFailCallback(t *testing.T, db *gorm.DB, table, msg string) func() {
	t.Helper()
	cbName := "fail_update_" + table + "_" + uuid.NewString()
	if err := db.Callback().Update().Before("gorm:update").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == table {
			tx.AddError(errors.New(msg))
		}
	}); err != nil {
		t.Fatalf("register callback: %v", err)
	}
	return func() {
		_ = db.Callback().Update().Remove(cbName)
	}
}

func registerCreateFailCallback(t *testing.T, db *gorm.DB, table, msg string) func() {
	t.Helper()
	cbName := "fail_create_" + table + "_" + uuid.NewString()
	if err := db.Callback().Create().Before("gorm:create").Register(cbName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == table {
			tx.AddError(errors.New(msg))
		}
	}); err != nil {
		t.Fatalf("register create callback: %v", err)
	}
	return func() {
		_ = db.Callback().Create().Remove(cbName)
	}
}

func TestAuthService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	userRepo := repository.NewUserRepo(db)

	svc := NewAuthService(userRepo, &config.Config{JWTSecret: "jwt-secret-test", JWTExpiry: "1h"})
	if svc == nil {
		t.Fatalf("NewAuthService should return instance")
	}

	reg, err := svc.Register(RegisterInput{
		Name:     "Alice",
		Email:    "alice@example.com",
		Phone:    "08123",
		Password: "secret123",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if reg.Token == "" {
		t.Fatalf("token should not be empty")
	}

	if _, err := svc.Register(RegisterInput{Name: "Alice", Email: "alice@example.com", Password: "secret123"}); err == nil || !strings.Contains(err.Error(), "email sudah terdaftar") {
		t.Fatalf("expected duplicate email error, got: %v", err)
	}

	longPass := strings.Repeat("x", 80)
	if _, err := svc.Register(RegisterInput{Name: "Long", Email: "long@example.com", Password: longPass}); err == nil || !strings.Contains(err.Error(), "gagal hash password") {
		t.Fatalf("expected hash error, got: %v", err)
	}

	removeUserCreateFail := registerCreateFailCallback(t, db, "users", "forced user create failure")
	if _, err := svc.Register(RegisterInput{Name: "CreateFail", Email: "create-fail@example.com", Password: "secret123"}); err == nil || !strings.Contains(err.Error(), "gagal membuat akun") {
		removeUserCreateFail()
		t.Fatalf("expected create account error, got: %v", err)
	}
	removeUserCreateFail()

	if _, err := svc.Login(LoginInput{Email: "none@example.com", Password: "x"}); err == nil || !strings.Contains(err.Error(), "email atau password salah") {
		t.Fatalf("expected invalid credentials, got: %v", err)
	}

	if _, err := svc.Login(LoginInput{Email: "alice@example.com", Password: "wrong"}); err == nil || !strings.Contains(err.Error(), "email atau password salah") {
		t.Fatalf("expected wrong password error, got: %v", err)
	}

	if _, err := svc.Login(LoginInput{Email: "alice@example.com", Password: "secret123"}); err != nil {
		t.Fatalf("login success expected, got: %v", err)
	}

	if err := db.Model(&model.User{}).Where("email = ?", "alice@example.com").Update("is_active", false).Error; err != nil {
		t.Fatalf("deactivate user: %v", err)
	}
	if _, err := svc.Login(LoginInput{Email: "alice@example.com", Password: "secret123"}); err == nil || !strings.Contains(err.Error(), "akun diblokir") {
		t.Fatalf("expected blocked error, got: %v", err)
	}

	if err := db.Model(&model.User{}).Where("email = ?", "alice@example.com").Update("is_active", true).Error; err != nil {
		t.Fatalf("reactivate user: %v", err)
	}
	user, err := userRepo.FindByEmail("alice@example.com")
	if err != nil {
		t.Fatalf("find user: %v", err)
	}

	if _, err := svc.GetProfile(user.ID); err != nil {
		t.Fatalf("get profile: %v", err)
	}

	if _, err := svc.UpdateProfile(uuid.New(), UpdateProfileInput{Name: "Ghost"}); err == nil || !strings.Contains(err.Error(), "user tidak ditemukan") {
		t.Fatalf("expected user not found, got: %v", err)
	}
	updated, err := svc.UpdateProfile(user.ID, UpdateProfileInput{Name: "Alice Updated", Phone: "08999"})
	if err != nil {
		t.Fatalf("update profile: %v", err)
	}
	if updated.Name != "Alice Updated" || updated.Phone != "08999" {
		t.Fatalf("profile not updated")
	}

	removeUserUpdateFail := registerUpdateFailCallback(t, db, "users", "forced user update failure")
	if _, err := svc.UpdateProfile(user.ID, UpdateProfileInput{Name: "Alice ForceFail"}); err == nil || !strings.Contains(err.Error(), "forced user update failure") {
		removeUserUpdateFail()
		t.Fatalf("expected update profile repo error, got: %v", err)
	}
	removeUserUpdateFail()

	if err := svc.ChangePassword(uuid.New(), ChangePasswordInput{OldPassword: "x", NewPassword: "newsecret"}); err == nil || !strings.Contains(err.Error(), "user tidak ditemukan") {
		t.Fatalf("expected user not found, got: %v", err)
	}
	if err := svc.ChangePassword(user.ID, ChangePasswordInput{OldPassword: "wrong", NewPassword: "newsecret"}); err == nil || !strings.Contains(err.Error(), "password lama salah") {
		t.Fatalf("expected wrong old password, got: %v", err)
	}
	if err := svc.ChangePassword(user.ID, ChangePasswordInput{OldPassword: "secret123", NewPassword: longPass}); err == nil || !strings.Contains(err.Error(), "gagal hash password") {
		t.Fatalf("expected hash error on change password, got: %v", err)
	}
	if err := svc.ChangePassword(user.ID, ChangePasswordInput{OldPassword: "secret123", NewPassword: "newsecret123"}); err != nil {
		t.Fatalf("change password success expected, got: %v", err)
	}

	svcNoSecret := NewAuthService(userRepo, &config.Config{JWTSecret: "", JWTExpiry: "1h"})
	if _, err := svcNoSecret.Register(RegisterInput{Name: "NoSecret", Email: "nosecret@example.com", Password: "secret123"}); err == nil || !strings.Contains(err.Error(), "JWT secret") {
		t.Fatalf("expected register token error, got: %v", err)
	}
	if _, err := svcNoSecret.Login(LoginInput{Email: "alice@example.com", Password: "newsecret123"}); err == nil || !strings.Contains(err.Error(), "JWT secret") {
		t.Fatalf("expected login token error, got: %v", err)
	}

	svcNilCfg := &AuthService{userRepo: userRepo, cfg: nil}
	if _, err := svcNilCfg.generateToken(user); err == nil || !strings.Contains(err.Error(), "config auth tidak valid") {
		t.Fatalf("expected nil config token error, got: %v", err)
	}

	cfg2 := &config.Config{JWTSecret: "jwt-secret-test", JWTExpiry: "invalid-duration"}
	svc2 := NewAuthService(userRepo, cfg2)
	if _, err := svc2.generateToken(user); err != nil {
		t.Fatalf("generate token with invalid duration should fallback, got: %v", err)
	}
}

func TestProductService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	productRepo := repository.NewProductRepo(db)
	stockRepo := repository.NewStockRepo(db)
	svc := NewProductService(productRepo, stockRepo)
	if svc == nil {
		t.Fatalf("NewProductService should return instance")
	}

	for i := 0; i < 13; i++ {
		_, _ = seedProductAndPrice(t, db, fmt.Sprintf("Prod %d", i), "streaming", "shared", 10000, 1)
	}
	inactive, _ := seedProductAndPrice(t, db, "Prod inactive", "music", "shared", 10000, 1)
	if err := db.Model(&model.Product{}).Where("id = ?", inactive.ID).Update("is_active", false).Error; err != nil {
		t.Fatalf("set inactive: %v", err)
	}

	list, total, err := svc.List("", 0, 999)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 12 {
		t.Fatalf("default limit should be 12, got %d", len(list))
	}
	if total < 13 {
		t.Fatalf("total should count active products")
	}

	musicProduct, _ := seedProductAndPrice(t, db, "Music One", "music", "shared", 15000, 1)
	filtered, _, err := svc.List("music", 1, 10)
	if err != nil {
		t.Fatalf("list by category: %v", err)
	}
	if len(filtered) == 0 {
		t.Fatalf("expected filtered products")
	}

	got, err := svc.GetBySlug(musicProduct.Slug)
	if err != nil || got.ID != musicProduct.ID {
		t.Fatalf("get by slug failed: %v", err)
	}

	created, err := svc.Create(CreateProductInput{Name: "Netflix Pro", Category: "streaming", Description: "desc", Icon: "🎬", Color: "#fff", IsPopular: true})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}
	if created.Slug == "" {
		t.Fatalf("slug should be generated")
	}
	if _, err := svc.Create(CreateProductInput{Name: "Netflix Pro", Category: "streaming"}); err == nil || !strings.Contains(err.Error(), "gagal membuat produk") {
		t.Fatalf("expected duplicate create error, got: %v", err)
	}

	if _, err := svc.Update(uuid.New(), UpdateProductInput{Name: "X"}); err == nil || !strings.Contains(err.Error(), "produk tidak ditemukan") {
		t.Fatalf("expected not found on update, got: %v", err)
	}

	isPopular := false
	isActive := false
	upd, err := svc.Update(created.ID, UpdateProductInput{
		Name:        "Netflix Ultra",
		Category:    "movie",
		Description: "new desc",
		Icon:        "📺",
		Color:       "#000",
		IsPopular:   &isPopular,
		IsActive:    &isActive,
	})
	if err != nil {
		t.Fatalf("update product: %v", err)
	}
	if upd.Name != "Netflix Ultra" || upd.Category != "movie" || upd.IsPopular || upd.IsActive {
		t.Fatalf("product not updated correctly")
	}

	removeProductUpdateFail := registerUpdateFailCallback(t, db, "products", "forced product update failure")
	if _, err := svc.Update(created.ID, UpdateProductInput{Name: "Force Fail Product"}); err == nil || !strings.Contains(err.Error(), "forced product update failure") {
		removeProductUpdateFail()
		t.Fatalf("expected product update repo error, got: %v", err)
	}
	removeProductUpdateFail()

	if err := svc.Delete(created.ID); err != nil {
		t.Fatalf("delete product: %v", err)
	}
	deleted, err := productRepo.FindByID(created.ID)
	if err != nil {
		t.Fatalf("find deleted product: %v", err)
	}
	if deleted.IsActive {
		t.Fatalf("deleted product should be inactive")
	}

	adminList, _, err := svc.AdminList(0, 0)
	if err != nil {
		t.Fatalf("admin list: %v", err)
	}
	if len(adminList) == 0 {
		t.Fatalf("admin list should return products")
	}

	stock1 := seedStock(t, db, musicProduct.ID, "shared", "available")
	_ = stock1
	stock2 := seedStock(t, db, musicProduct.ID, "shared", "used")
	_ = stock2
	count, err := svc.GetStockCount(musicProduct.ID, "shared")
	if err != nil {
		t.Fatalf("get stock count: %v", err)
	}
	if count < 1 {
		t.Fatalf("stock count should include available stock")
	}

	if slug := generateSlug("Canva Pro+ 2026!!!"); slug != "canva-proplus-2026" {
		t.Fatalf("unexpected slug: %s", slug)
	}
}

func TestStockService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	stockRepo := repository.NewStockRepo(db)
	product, _ := seedProductAndPrice(t, db, "Spotify", "music", "shared", 10000, 1)

	svc := NewStockService(stockRepo)
	if svc == nil {
		t.Fatalf("NewStockService should return instance")
	}

	if _, err := svc.Create(CreateStockInput{ProductID: "invalid", AccountType: "shared", Email: "a@b.com", Password: "123456"}); err == nil || !strings.Contains(err.Error(), "product_id tidak valid") {
		t.Fatalf("expected invalid product_id, got: %v", err)
	}

	longPass := strings.Repeat("x", 80)
	if _, err := svc.Create(CreateStockInput{ProductID: product.ID.String(), AccountType: "shared", Email: "a@b.com", Password: longPass}); err == nil || !strings.Contains(err.Error(), "gagal enkripsi password") {
		t.Fatalf("expected hash error, got: %v", err)
	}

	created, err := svc.Create(CreateStockInput{ProductID: product.ID.String(), AccountType: "shared", Email: "ok@b.com", Password: "abc12345", ProfileName: "P1"})
	if err != nil {
		t.Fatalf("create stock: %v", err)
	}
	if created.Password == "abc12345" {
		t.Fatalf("password should be encrypted")
	}

	dbErr := setupCoreDB(t)
	svcErr := NewStockService(repository.NewStockRepo(dbErr))
	productErr, _ := seedProductAndPrice(t, dbErr, "Drop", "streaming", "shared", 10000, 1)
	if err := dbErr.Migrator().DropTable(&model.Stock{}); err != nil {
		t.Fatalf("drop stocks table: %v", err)
	}
	if _, err := svcErr.Create(CreateStockInput{ProductID: productErr.ID.String(), AccountType: "shared", Email: "x@y.com", Password: "abc12345"}); err == nil || !strings.Contains(err.Error(), "gagal menambah stok") {
		t.Fatalf("expected create repo error, got: %v", err)
	}

	if _, err := svc.CreateBulk(BulkStockInput{ProductID: "invalid", AccountType: "shared", Accounts: []struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		ProfileName string `json:"profile_name"`
	}{{Email: "a", Password: "b"}}}); err == nil || !strings.Contains(err.Error(), "product_id tidak valid") {
		t.Fatalf("expected invalid bulk product_id, got: %v", err)
	}

	count, err := svc.CreateBulk(BulkStockInput{
		ProductID:   product.ID.String(),
		AccountType: "private",
		Accounts: []struct {
			Email       string `json:"email"`
			Password    string `json:"password"`
			ProfileName string `json:"profile_name"`
		}{
			{Email: "b1@x.com", Password: "123456", ProfileName: "b1"},
			{Email: "b2@x.com", Password: "123456", ProfileName: "b2"},
		},
	})
	if err != nil || count != 2 {
		t.Fatalf("bulk create failed: count=%d err=%v", count, err)
	}

	dbBulkErr := setupCoreDB(t)
	svcBulkErr := NewStockService(repository.NewStockRepo(dbBulkErr))
	productBulkErr, _ := seedProductAndPrice(t, dbBulkErr, "BulkErr", "streaming", "shared", 10000, 1)
	if err := dbBulkErr.Migrator().DropTable(&model.Stock{}); err != nil {
		t.Fatalf("drop stocks table bulk: %v", err)
	}
	if _, err := svcBulkErr.CreateBulk(BulkStockInput{ProductID: productBulkErr.ID.String(), AccountType: "shared", Accounts: []struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		ProfileName string `json:"profile_name"`
	}{{Email: "a@x.com", Password: "12345"}}}); err == nil || !strings.Contains(err.Error(), "gagal menambah stok bulk") {
		t.Fatalf("expected bulk repo error, got: %v", err)
	}

	stocks, total, err := svc.List(nil, "", 0, 0)
	if err != nil {
		t.Fatalf("list stocks: %v", err)
	}
	if len(stocks) == 0 || total == 0 {
		t.Fatalf("expected listed stocks")
	}

	if _, err := svc.Update(uuid.New(), CreateStockInput{Email: "new@x.com", AccountType: "shared"}); err == nil || !strings.Contains(err.Error(), "stok tidak ditemukan") {
		t.Fatalf("expected update not found, got: %v", err)
	}

	upd, err := svc.Update(created.ID, CreateStockInput{Email: "new@x.com", Password: "newpass123", ProfileName: "new", AccountType: "private"})
	if err != nil {
		t.Fatalf("update stock: %v", err)
	}
	if upd.Email != "new@x.com" || upd.AccountType != "private" {
		t.Fatalf("stock not updated")
	}

	upd2, err := svc.Update(created.ID, CreateStockInput{Email: "keep@x.com", Password: "", ProfileName: "keep", AccountType: "shared"})
	if err != nil {
		t.Fatalf("update stock without password: %v", err)
	}
	if upd2.Email != "keep@x.com" || upd2.AccountType != "shared" {
		t.Fatalf("stock update second failed")
	}

	removeStockUpdateFail := registerUpdateFailCallback(t, db, "stocks", "forced stock update failure")
	if _, err := svc.Update(created.ID, CreateStockInput{Email: "fail@x.com", Password: "abc", AccountType: "shared"}); err == nil || !strings.Contains(err.Error(), "forced stock update failure") {
		removeStockUpdateFail()
		t.Fatalf("expected stock update repo error, got: %v", err)
	}
	removeStockUpdateFail()

	if err := svc.Delete(uuid.New()); err == nil || !strings.Contains(err.Error(), "stok tidak ditemukan") {
		t.Fatalf("expected delete not found, got: %v", err)
	}

	used := seedStock(t, db, product.ID, "shared", "used")
	if err := svc.Delete(used.ID); err == nil || !strings.Contains(err.Error(), "stok sedang digunakan") {
		t.Fatalf("expected used stock delete error, got: %v", err)
	}

	available := seedStock(t, db, product.ID, "shared", "available")
	if err := svc.Delete(available.ID); err != nil {
		t.Fatalf("delete available stock: %v", err)
	}
}

func TestNotificationService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	user := seedUser(t, db, "notif@example.com", true)
	notifRepo := repository.NewNotificationRepo(db)
	svc := NewNotificationService(notifRepo)
	if svc == nil {
		t.Fatalf("NewNotificationService should return instance")
	}

	for i := 0; i < 21; i++ {
		n := &model.Notification{UserID: user.ID, Title: fmt.Sprintf("n-%d", i), Message: "hello", Type: "test"}
		if err := notifRepo.Create(n); err != nil {
			t.Fatalf("create notif %d: %v", i, err)
		}
	}

	rows, total, err := svc.List(user.ID, 0, 0)
	if err != nil {
		t.Fatalf("list notif: %v", err)
	}
	if len(rows) != 20 || total != 21 {
		t.Fatalf("unexpected list notif result len=%d total=%d", len(rows), total)
	}

	if err := svc.MarkRead(rows[0].ID, user.ID); err != nil {
		t.Fatalf("mark read: %v", err)
	}

	unread, err := svc.CountUnread(user.ID)
	if err != nil {
		t.Fatalf("count unread: %v", err)
	}
	if unread != 20 {
		t.Fatalf("expected unread=20, got %d", unread)
	}
}

func TestOrderService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	user := seedUser(t, db, "order-user@example.com", true)
	other := seedUser(t, db, "order-other@example.com", true)
	product, price := seedProductAndPrice(t, db, "Netflix O", "streaming", "shared", 55000, 1)
	_ = product

	orderRepo := repository.NewOrderRepo(db)
	stockRepo := repository.NewStockRepo(db)
	productRepo := repository.NewProductRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	svc := NewOrderService(orderRepo, stockRepo, productRepo, notifRepo)
	if svc == nil {
		t.Fatalf("NewOrderService should return instance")
	}

	if _, err := svc.Create(user.ID, CreateOrderInput{PriceID: "invalid"}); err == nil || !strings.Contains(err.Error(), "price_id tidak valid") {
		t.Fatalf("expected invalid price_id, got: %v", err)
	}

	created, err := svc.Create(user.ID, CreateOrderInput{PriceID: price.ID.String()})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if created.TotalPrice != price.Price {
		t.Fatalf("total price mismatch: got %d want %d", created.TotalPrice, price.Price)
	}

	dbCreateErr := setupCoreDB(t)
	userCreateErr := seedUser(t, dbCreateErr, "order-ce@example.com", true)
	_, priceCreateErr := seedProductAndPrice(t, dbCreateErr, "Prod CE", "streaming", "shared", 10000, 1)
	svcCreateErr := NewOrderService(repository.NewOrderRepo(dbCreateErr), repository.NewStockRepo(dbCreateErr), repository.NewProductRepo(dbCreateErr), repository.NewNotificationRepo(dbCreateErr))
	if err := dbCreateErr.Migrator().DropTable(&model.Order{}); err != nil {
		t.Fatalf("drop orders: %v", err)
	}
	if _, err := svcCreateErr.Create(userCreateErr.ID, CreateOrderInput{PriceID: priceCreateErr.ID.String()}); err == nil || !strings.Contains(err.Error(), "gagal membuat order") {
		t.Fatalf("expected create order repo error, got: %v", err)
	}

	if _, err := svc.GetByID(uuid.New(), user.ID); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected not found on get by id, got: %v", err)
	}
	if _, err := svc.GetByID(created.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected access denied, got: %v", err)
	}
	if _, err := svc.GetByID(created.ID, user.ID); err != nil {
		t.Fatalf("get by id success: %v", err)
	}

	list, total, err := svc.ListByUser(user.ID, 0, 0)
	if err != nil {
		t.Fatalf("list by user: %v", err)
	}
	if len(list) == 0 || total == 0 {
		t.Fatalf("expected list result")
	}

	if err := svc.Cancel(uuid.New(), user.ID); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected cancel not found, got: %v", err)
	}
	if err := svc.Cancel(created.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected cancel access denied, got: %v", err)
	}
	if err := db.Model(&model.Order{}).Where("id = ?", created.ID).Update("payment_status", "paid").Error; err != nil {
		t.Fatalf("set paid: %v", err)
	}
	if err := svc.Cancel(created.ID, user.ID); err == nil || !strings.Contains(err.Error(), "order tidak bisa dibatalkan") {
		t.Fatalf("expected cannot cancel, got: %v", err)
	}

	cancelable := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if err := svc.Cancel(cancelable.ID, user.ID); err != nil {
		t.Fatalf("cancel success: %v", err)
	}

	if err := svc.ConfirmPayment(uuid.New()); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected confirm not found, got: %v", err)
	}

	noStockOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if err := svc.ConfirmPayment(noStockOrder.ID); err == nil || !strings.Contains(err.Error(), "stok tidak tersedia") {
		t.Fatalf("expected no stock error, got: %v", err)
	}

	stockForUpdateErr := seedStock(t, db, product.ID, "shared", "available")
	_ = stockForUpdateErr
	updateErrOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	removeStockCb := registerUpdateFailCallback(t, db, "stocks", "stock update forced error")
	if err := svc.ConfirmPayment(updateErrOrder.ID); err == nil || !strings.Contains(err.Error(), "stock update forced error") {
		removeStockCb()
		t.Fatalf("expected stock update error, got: %v", err)
	}
	removeStockCb()

	seedStock(t, db, product.ID, "shared", "available")
	updateOrderErr := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	removeOrderCb := registerUpdateFailCallback(t, db, "orders", "order update forced error")
	if err := svc.ConfirmPayment(updateOrderErr.ID); err == nil || !strings.Contains(err.Error(), "order update forced error") {
		removeOrderCb()
		t.Fatalf("expected order update error, got: %v", err)
	}
	removeOrderCb()

	seedStock(t, db, product.ID, "shared", "available")
	okOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if err := svc.ConfirmPayment(okOrder.ID); err != nil {
		t.Fatalf("confirm payment success: %v", err)
	}
	confirmed, err := orderRepo.FindByID(okOrder.ID)
	if err != nil {
		t.Fatalf("find confirmed order: %v", err)
	}
	if confirmed.PaymentStatus != "paid" || confirmed.OrderStatus != "active" || confirmed.StockID == nil {
		t.Fatalf("order not confirmed properly")
	}

	adminRows, _, err := svc.AdminList("", 0, 0)
	if err != nil || len(adminRows) == 0 {
		t.Fatalf("admin list failed: %v", err)
	}
	if _, err := svc.AdminGetByID(confirmed.ID); err != nil {
		t.Fatalf("admin get by id failed: %v", err)
	}

	seedStock(t, db, product.ID, "shared", "available")
	manualOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if err := svc.ManualSendAccount(manualOrder.ID); err != nil {
		t.Fatalf("manual send account failed: %v", err)
	}
}

type fakePakasirOrderClient struct {
	createHits    int
	detailHits    int
	statusByID    map[string]string
	amountByID    map[string]int64
	methodByID    map[string]string
	createErr     error
	detailErrByID map[string]error
}

func newFakePakasirOrderClient() *fakePakasirOrderClient {
	return &fakePakasirOrderClient{
		statusByID:    map[string]string{},
		amountByID:    map[string]int64{},
		methodByID:    map[string]string{},
		detailErrByID: map[string]error{},
	}
}

func (f *fakePakasirOrderClient) CreateTransaction(_ context.Context, method, orderID string, amount int64) (*PakasirCreateResult, []byte, error) {
	if f.createErr != nil {
		return nil, nil, f.createErr
	}
	f.createHits++
	if method == "" {
		method = "qris"
	}
	if _, ok := f.statusByID[orderID]; !ok {
		f.statusByID[orderID] = "PENDING"
	}
	f.amountByID[orderID] = amount
	f.methodByID[orderID] = method
	return &PakasirCreateResult{
		OrderID:       orderID,
		PaymentMethod: method,
		PaymentNumber: "000201...",
		Amount:        amount,
		TotalPayment:  amount + 3000,
		ExpiredAt:     time.Now().UTC().Add(15 * time.Minute),
	}, []byte(`{"ok":true}`), nil
}

func (f *fakePakasirOrderClient) TransactionDetail(_ context.Context, orderID string, amount int64) (*PakasirDetailResult, []byte, error) {
	f.detailHits++
	if err := f.detailErrByID[orderID]; err != nil {
		return nil, nil, err
	}
	status := f.statusByID[orderID]
	if status == "" {
		status = "PENDING"
	}
	if overridden, ok := f.amountByID[orderID]; ok && overridden > 0 {
		amount = overridden
	} else if amount <= 0 {
		amount = f.amountByID[orderID]
	}
	method := f.methodByID[orderID]
	if method == "" {
		method = "qris"
	}
	return &PakasirDetailResult{
		OrderID:       orderID,
		Amount:        amount,
		Status:        NormalizePakasirStatus(status),
		PaymentMethod: method,
	}, []byte(`{"ok":true}`), nil
}

func (f *fakePakasirOrderClient) TransactionCancel(_ context.Context, _ string, _ int64) ([]byte, error) {
	return []byte(`{"ok":true}`), nil
}

func TestPaymentService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	user := seedUser(t, db, "payment-user@example.com", true)
	other := seedUser(t, db, "payment-other@example.com", true)
	product, price := seedProductAndPrice(t, db, "Pay Prod", "streaming", "shared", 45000, 1)

	orderRepo := repository.NewOrderRepo(db)
	stockRepo := repository.NewStockRepo(db)
	productRepo := repository.NewProductRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	orderSvc := NewOrderService(orderRepo, stockRepo, productRepo, notifRepo)

	fake := newFakePakasirOrderClient()
	cfg := &config.Config{
		PakasirProject: "premiumhub",
		PakasirAPIKey:  "PK_test",
	}
	svc := NewPaymentServiceWithGateway(cfg, orderRepo, orderSvc, fake)
	if svc == nil {
		t.Fatalf("NewPaymentServiceWithGateway should return instance")
	}

	if _, err := svc.CreateTransaction(user.ID, CreatePaymentInput{OrderID: "invalid"}); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected order not found for invalid id, got: %v", err)
	}

	pendingOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if _, err := svc.CreateTransaction(other.ID, CreatePaymentInput{OrderID: pendingOrder.ID.String()}); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected access denied, got: %v", err)
	}

	processed := seedOrder(t, db, user.ID, price.ID, "paid", price.Price)
	if _, err := svc.CreateTransaction(user.ID, CreatePaymentInput{OrderID: processed.ID.String()}); err == nil || !strings.Contains(err.Error(), "order sudah diproses") {
		t.Fatalf("expected processed order error, got: %v", err)
	}

	createdTx, err := svc.CreateTransaction(user.ID, CreatePaymentInput{OrderID: pendingOrder.ID.String(), PaymentMethod: "qris"})
	if err != nil {
		t.Fatalf("create transaction: %v", err)
	}
	if createdTx.PaymentNumber == "" || createdTx.GatewayOrderID == "" {
		t.Fatalf("payment_number/gateway_order_id should be generated")
	}

	pendingUpdated, err := orderRepo.FindByID(pendingOrder.ID)
	if err != nil {
		t.Fatalf("find pending updated: %v", err)
	}
	if pendingUpdated.GatewayOrderID == "" || pendingUpdated.PaymentPayload == "" {
		t.Fatalf("gateway order data should be persisted")
	}

	if err := svc.HandleWebhook(WebhookInput{OrderID: "missing", Project: "premiumhub", Status: "COMPLETED"}); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected webhook order not found, got: %v", err)
	}

	captureOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	captureOrder.GatewayOrderID = "ORD-CAP-1"
	if err := orderRepo.Update(captureOrder); err != nil {
		t.Fatalf("update capture order: %v", err)
	}
	fake.statusByID["ORD-CAP-1"] = "COMPLETED"
	fake.amountByID["ORD-CAP-1"] = captureOrder.TotalPrice
	fake.methodByID["ORD-CAP-1"] = "qris"

	seedStock(t, db, product.ID, "shared", "available")
	if err := svc.HandleWebhook(WebhookInput{OrderID: "ORD-CAP-1", Project: "premiumhub", Status: "COMPLETED", PaymentMethod: "qris"}); err != nil {
		t.Fatalf("webhook capture: %v", err)
	}

	captureUpdated, err := orderRepo.FindByID(captureOrder.ID)
	if err != nil {
		t.Fatalf("find capture updated: %v", err)
	}
	if captureUpdated.PaymentMethod != "qris" || captureUpdated.PaymentStatus != "paid" {
		t.Fatalf("capture webhook did not confirm payment")
	}

	captureNoStock := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	captureNoStock.GatewayOrderID = "ORD-CAP-2"
	if err := orderRepo.Update(captureNoStock); err != nil {
		t.Fatalf("update capture no stock order: %v", err)
	}
	fake.statusByID["ORD-CAP-2"] = "COMPLETED"
	fake.amountByID["ORD-CAP-2"] = captureNoStock.TotalPrice
	if err := svc.HandleWebhook(WebhookInput{OrderID: "ORD-CAP-2", Project: "premiumhub", Status: "COMPLETED"}); err == nil || !strings.Contains(err.Error(), "stok tidak tersedia") {
		t.Fatalf("expected settlement confirm error, got: %v", err)
	}

	amountMismatch := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	amountMismatch.GatewayOrderID = "ORD-MIS-1"
	if err := orderRepo.Update(amountMismatch); err != nil {
		t.Fatalf("update amount mismatch order: %v", err)
	}
	fake.statusByID["ORD-MIS-1"] = "COMPLETED"
	fake.amountByID["ORD-MIS-1"] = amountMismatch.TotalPrice + 123
	if err := svc.HandleWebhook(WebhookInput{OrderID: "ORD-MIS-1", Project: "premiumhub", Status: "COMPLETED"}); err == nil || !strings.Contains(err.Error(), "nominal pembayaran tidak cocok") {
		t.Fatalf("expected amount mismatch error, got: %v", err)
	}

	projectMismatch := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	projectMismatch.GatewayOrderID = "ORD-PROJ-1"
	if err := orderRepo.Update(projectMismatch); err != nil {
		t.Fatalf("update project mismatch order: %v", err)
	}
	fake.statusByID["ORD-PROJ-1"] = "COMPLETED"
	fake.amountByID["ORD-PROJ-1"] = projectMismatch.TotalPrice
	if err := svc.HandleWebhook(WebhookInput{OrderID: "ORD-PROJ-1", Project: "other-project", Status: "COMPLETED"}); err != nil {
		t.Fatalf("project mismatch should be ignored, got: %v", err)
	}
	projectMismatchUpdated, _ := orderRepo.FindByID(projectMismatch.ID)
	if projectMismatchUpdated.PaymentStatus != "pending" {
		t.Fatalf("project mismatch should not update order")
	}

	if _, err := svc.GetStatus(uuid.New(), user.ID); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected get status not found, got: %v", err)
	}
	if _, err := svc.GetStatus(projectMismatch.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected get status access denied, got: %v", err)
	}
	if _, err := svc.GetStatus(projectMismatch.ID, user.ID); err != nil {
		t.Fatalf("get status success expected: %v", err)
	}
}

func TestClaimService_AllBranches(t *testing.T) {
	db := setupCoreDB(t)
	user := seedUser(t, db, "claim-user@example.com", true)
	other := seedUser(t, db, "claim-other@example.com", true)
	product, price := seedProductAndPrice(t, db, "Claim Prod", "streaming", "shared", 30000, 1)

	claimRepo := repository.NewClaimRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	stockRepo := repository.NewStockRepo(db)
	notifRepo := repository.NewNotificationRepo(db)
	svc := NewClaimService(claimRepo, orderRepo, stockRepo, notifRepo)
	if svc == nil {
		t.Fatalf("NewClaimService should return instance")
	}

	if _, err := svc.Create(user.ID, CreateClaimInput{OrderID: "invalid", Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "order_id tidak valid") {
		t.Fatalf("expected invalid order_id, got: %v", err)
	}

	if _, err := svc.Create(user.ID, CreateClaimInput{OrderID: uuid.NewString(), Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected order not found, got: %v", err)
	}

	pendingOrder := seedOrder(t, db, user.ID, price.ID, "pending", price.Price)
	if _, err := svc.Create(user.ID, CreateClaimInput{OrderID: pendingOrder.ID.String(), Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "order tidak aktif") {
		t.Fatalf("expected order not active, got: %v", err)
	}

	foreignOrder := seedOrder(t, db, other.ID, price.ID, "active", price.Price)
	if _, err := svc.Create(user.ID, CreateClaimInput{OrderID: foreignOrder.ID.String(), Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "order tidak ditemukan") {
		t.Fatalf("expected order ownership error, got: %v", err)
	}

	expiredTime := time.Now().Add(-1 * time.Hour)
	expiredOrder := seedOrder(t, db, user.ID, price.ID, "active", price.Price)
	if err := db.Model(&model.Order{}).Where("id = ?", expiredOrder.ID).Updates(map[string]interface{}{"expires_at": expiredTime, "order_status": "active"}).Error; err != nil {
		t.Fatalf("set expired order: %v", err)
	}
	if _, err := svc.Create(user.ID, CreateClaimInput{OrderID: expiredOrder.ID.String(), Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "masa garansi sudah habis") {
		t.Fatalf("expected warranty expired, got: %v", err)
	}

	activeFuture := time.Now().Add(24 * time.Hour)
	activeOrder := seedOrder(t, db, user.ID, price.ID, "active", price.Price)
	if err := db.Model(&model.Order{}).Where("id = ?", activeOrder.ID).Update("expires_at", activeFuture).Error; err != nil {
		t.Fatalf("set active expires_at: %v", err)
	}
	created, err := svc.Create(user.ID, CreateClaimInput{OrderID: activeOrder.ID.String(), Reason: "akun", Description: "rusak", ScreenshotURL: "http://x"})
	if err != nil {
		t.Fatalf("create claim success expected: %v", err)
	}
	if created.Status != "pending" {
		t.Fatalf("claim status should be pending")
	}

	dbCreateErr := setupCoreDB(t)
	userCreateErr := seedUser(t, dbCreateErr, "claim-ce@example.com", true)
	_, priceCreateErr := seedProductAndPrice(t, dbCreateErr, "Claim CE", "streaming", "shared", 20000, 1)
	orderCreateErr := seedOrder(t, dbCreateErr, userCreateErr.ID, priceCreateErr.ID, "active", priceCreateErr.Price)
	if err := dbCreateErr.Model(&model.Order{}).Where("id = ?", orderCreateErr.ID).Update("expires_at", time.Now().Add(1*time.Hour)).Error; err != nil {
		t.Fatalf("set claim create err expires: %v", err)
	}
	svcCreateErr := NewClaimService(repository.NewClaimRepo(dbCreateErr), repository.NewOrderRepo(dbCreateErr), repository.NewStockRepo(dbCreateErr), repository.NewNotificationRepo(dbCreateErr))
	if err := dbCreateErr.Migrator().DropTable(&model.Claim{}); err != nil {
		t.Fatalf("drop claims table: %v", err)
	}
	if _, err := svcCreateErr.Create(userCreateErr.ID, CreateClaimInput{OrderID: orderCreateErr.ID.String(), Reason: "r", Description: "d"}); err == nil || !strings.Contains(err.Error(), "gagal membuat klaim") {
		t.Fatalf("expected create claim repo error, got: %v", err)
	}

	claims, total, err := svc.ListByUser(user.ID, 0, 0)
	if err != nil || total == 0 || len(claims) == 0 {
		t.Fatalf("list by user failed: total=%d len=%d err=%v", total, len(claims), err)
	}

	if _, err := svc.GetByID(uuid.New(), user.ID); err == nil || !strings.Contains(err.Error(), "klaim tidak ditemukan") {
		t.Fatalf("expected get claim not found, got: %v", err)
	}
	if _, err := svc.GetByID(created.ID, other.ID); err == nil || !strings.Contains(err.Error(), "akses ditolak") {
		t.Fatalf("expected get claim access denied, got: %v", err)
	}
	if _, err := svc.GetByID(created.ID, user.ID); err != nil {
		t.Fatalf("get claim success expected, got: %v", err)
	}

	if err := svc.Approve(uuid.New(), AdminActionInput{AdminNote: "x"}); err == nil || !strings.Contains(err.Error(), "klaim tidak ditemukan") {
		t.Fatalf("expected approve not found, got: %v", err)
	}

	claimNoStockOrder := seedOrder(t, db, user.ID, price.ID, "active", price.Price)
	if err := db.Model(&model.Order{}).Where("id = ?", claimNoStockOrder.ID).Update("expires_at", time.Now().Add(1*time.Hour)).Error; err != nil {
		t.Fatalf("set claim no stock expires: %v", err)
	}
	claimNoStock := seedClaim(t, db, user.ID, claimNoStockOrder.ID, "pending")
	if err := svc.Approve(claimNoStock.ID, AdminActionInput{AdminNote: "ok"}); err == nil || !strings.Contains(err.Error(), "stok pengganti tidak tersedia") {
		t.Fatalf("expected approve no stock error, got: %v", err)
	}

	oldStock := seedStock(t, db, product.ID, "shared", "used")
	claimOrder := seedOrder(t, db, user.ID, price.ID, "active", price.Price)
	if err := db.Model(&model.Order{}).Where("id = ?", claimOrder.ID).Updates(map[string]interface{}{"stock_id": oldStock.ID, "expires_at": time.Now().Add(1 * time.Hour)}).Error; err != nil {
		t.Fatalf("prepare claim order: %v", err)
	}
	claimApprove := seedClaim(t, db, user.ID, claimOrder.ID, "pending")
	newStock := seedStock(t, db, product.ID, "shared", "available")
	_ = newStock

	if err := svc.Approve(claimApprove.ID, AdminActionInput{AdminNote: "approved"}); err != nil {
		t.Fatalf("approve claim success expected: %v", err)
	}

	approvedClaim, err := claimRepo.FindByID(claimApprove.ID)
	if err != nil {
		t.Fatalf("find approved claim: %v", err)
	}
	if approvedClaim.Status != "approved" || approvedClaim.NewStockID == nil {
		t.Fatalf("claim not approved correctly")
	}
	oldStockAfter, err := stockRepo.FindByID(oldStock.ID)
	if err != nil {
		t.Fatalf("find old stock: %v", err)
	}
	if oldStockAfter.Status != "expired" {
		t.Fatalf("old stock should be expired after approve")
	}

	if err := svc.Reject(uuid.New(), AdminActionInput{AdminNote: "no"}); err == nil || !strings.Contains(err.Error(), "klaim tidak ditemukan") {
		t.Fatalf("expected reject not found, got: %v", err)
	}
	rejectClaim := seedClaim(t, db, user.ID, activeOrder.ID, "pending")
	if err := svc.Reject(rejectClaim.ID, AdminActionInput{AdminNote: "invalid evidence"}); err != nil {
		t.Fatalf("reject claim: %v", err)
	}
	rejected, _ := claimRepo.FindByID(rejectClaim.ID)
	if rejected.Status != "rejected" {
		t.Fatalf("claim should be rejected")
	}

	adminClaims, _, err := svc.AdminList("", 0, 0)
	if err != nil || len(adminClaims) == 0 {
		t.Fatalf("admin list claims failed: %v", err)
	}
}
