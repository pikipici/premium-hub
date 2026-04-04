package main

import (
	"fmt"
	"log"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/pkg/hash"

	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()
	db := config.InitDB(cfg)

	// Seed admin user
	adminPw, _ := hash.Password("admin123")
	admin := model.User{
		Name:     "Admin PremiumHub",
		Email:    "admin@premiumhub.id",
		Phone:    "081234567890",
		Password: adminPw,
		Role:     "admin",
		IsActive: true,
	}
	if err := db.FirstOrCreate(&admin, model.User{Email: admin.Email}).Error; err != nil {
		log.Fatal("Seed admin:", err)
	}
	fmt.Printf("✓ Admin: %s / admin123\n", admin.Email)

	// Seed demo user
	userPw, _ := hash.Password("user123")
	user := model.User{
		Name:     "Demo User",
		Email:    "user@premiumhub.id",
		Phone:    "081298765432",
		Password: userPw,
		Role:     "user",
		IsActive: true,
	}
	db.FirstOrCreate(&user, model.User{Email: user.Email})
	fmt.Printf("✓ User: %s / user123\n", user.Email)

	// Seed products
	products := []struct {
		Name     string
		Category string
		Icon     string
		Color    string
		Popular  bool
		Prices   []struct {
			Duration    int
			AccountType string
			Price       int64
		}
	}{
		{
			Name: "Netflix", Category: "streaming", Icon: "🎬", Color: "#C8E6F5", Popular: true,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 25000}, {3, "shared", 65000}, {6, "shared", 120000}, {12, "shared", 220000},
				{1, "private", 55000}, {3, "private", 150000}, {6, "private", 280000}, {12, "private", 520000},
			},
		},
		{
			Name: "Spotify Premium", Category: "music", Icon: "🎵", Color: "#DDD5F3", Popular: true,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 15000}, {3, "shared", 40000}, {6, "shared", 75000}, {12, "shared", 135000},
				{1, "private", 35000}, {3, "private", 95000}, {6, "private", 175000}, {12, "private", 330000},
			},
		},
		{
			Name: "Disney+", Category: "streaming", Icon: "✨", Color: "#FAE88A", Popular: true,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 20000}, {3, "shared", 55000}, {6, "shared", 100000}, {12, "shared", 180000},
				{1, "private", 45000}, {3, "private", 120000}, {6, "private", 220000}, {12, "private", 400000},
			},
		},
		{
			Name: "YouTube Premium", Category: "streaming", Icon: "📺", Color: "#C8E6F5", Popular: true,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 15000}, {3, "shared", 40000}, {6, "shared", 70000}, {12, "shared", 130000},
				{1, "private", 30000}, {3, "private", 80000}, {6, "private", 150000}, {12, "private", 280000},
			},
		},
		{
			Name: "Canva Pro", Category: "design", Icon: "🎨", Color: "#E5D5F5", Popular: false,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 20000}, {3, "shared", 50000}, {6, "shared", 90000}, {12, "shared", 160000},
				{1, "private", 45000}, {3, "private", 120000}, {6, "private", 220000}, {12, "private", 400000},
			},
		},
		{
			Name: "Xbox Game Pass", Category: "gaming", Icon: "🎮", Color: "#FDDAC8", Popular: false,
			Prices: []struct {
				Duration    int
				AccountType string
				Price       int64
			}{
				{1, "shared", 25000}, {3, "shared", 65000}, {6, "shared", 120000}, {12, "shared", 220000},
				{1, "private", 50000}, {3, "private", 135000}, {6, "private", 250000}, {12, "private", 470000},
			},
		},
	}

	for _, p := range products {
		slug := generateSlug(p.Name)
		product := model.Product{
			Name:        p.Name,
			Slug:        slug,
			Category:    p.Category,
			Icon:        p.Icon,
			Color:       p.Color,
			IsPopular:   p.Popular,
			IsActive:    true,
			Description: fmt.Sprintf("Akun %s premium dengan garansi 30 hari. Tersedia pilihan shared dan private account.", p.Name),
		}
		db.FirstOrCreate(&product, model.Product{Slug: slug})

		for _, pr := range p.Prices {
			price := model.ProductPrice{
				ProductID:   product.ID,
				Duration:    pr.Duration,
				AccountType: pr.AccountType,
				Price:       pr.Price,
				IsActive:    true,
			}
			db.FirstOrCreate(&price, model.ProductPrice{
				ProductID: product.ID, Duration: pr.Duration, AccountType: pr.AccountType,
			})
		}

		// Seed sample stocks for each product
		for i := 1; i <= 3; i++ {
			for _, accType := range []string{"shared", "private"} {
				encPw, _ := hash.Password(fmt.Sprintf("pass%d%s", i, accType))
				stock := model.Stock{
					ProductID:   product.ID,
					AccountType: accType,
					Email:       fmt.Sprintf("%s-%s-%d@premiumhub.demo", slug, accType, i),
					Password:    encPw,
					ProfileName: fmt.Sprintf("Profile %d", i),
					Status:      "available",
				}
				db.FirstOrCreate(&stock, model.Stock{Email: stock.Email})
			}
		}
		fmt.Printf("✓ Product: %s %s (6 stocks)\n", p.Icon, p.Name)
	}

	fmt.Println("\n🎉 Seed selesai!")
	fmt.Println("  Admin login: admin@premiumhub.id / admin123")
	fmt.Println("  User login:  user@premiumhub.id / user123")
}

func generateSlug(name string) string {
	slug := ""
	for _, c := range []byte(name) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			slug += string(c)
		} else if c >= 'A' && c <= 'Z' {
			slug += string(c + 32)
		} else if c == ' ' {
			slug += "-"
		} else if c == '+' {
			slug += "plus"
		}
	}
	// Remove trailing/double hyphens
	result := ""
	prev := byte(0)
	for _, c := range []byte(slug) {
		if c == '-' && prev == '-' {
			continue
		}
		result += string(c)
		prev = c
	}
	// use uuid suffix for uniqueness if needed
	_ = uuid.New
	return result
}
