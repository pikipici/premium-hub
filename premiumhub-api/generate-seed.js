const fs = require('fs');

const md = fs.readFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/rekomendasi-layanan-satuan-jap.md', 'utf8');

const lines = md.split('\n');
let currentCategory = '';
let currentPlatform = '';
const services = [];

for (const line of lines) {
  if (line.startsWith('## ')) {
    const header = line.replace('## ', '').trim();
    if (header.includes('Instagram')) currentPlatform = 'Instagram';
    else if (header.includes('TikTok')) currentPlatform = 'TikTok';
    else if (header.includes('YouTube')) currentPlatform = 'YouTube';
    else if (header.includes('Facebook')) currentPlatform = 'Facebook';
    else if (header.includes('Telegram')) currentPlatform = 'Telegram';
    else if (header.includes('Twitter') || header.includes('X (Twitter)')) currentPlatform = 'Twitter';
    else if (header.includes('Shopee')) currentPlatform = 'Shopee';
    else if (header.includes('Website Traffic')) currentPlatform = 'Website Traffic';
    else if (header.includes('Spotify')) currentPlatform = 'Spotify';
  }

  if (line.startsWith('| `') && line.includes('|')) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length >= 8) {
      const providerServiceId = parts[1].replace(/`/g, '');
      const title = parts[2];
      const minOrder = parts[4];
      const refillText = parts[6];
      const isRefill = refillText.includes('✅');
      const modalIDR = parseInt(parts[8].replace(/Rp|\.| /g, ''));
      
      let categoryCode = 'followers';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('like')) categoryCode = 'likes';
      else if (lowerTitle.includes('view') || lowerTitle.includes('impression')) categoryCode = 'views';
      else if (lowerTitle.includes('comment')) categoryCode = 'comments';
      else if (lowerTitle.includes('subscribers') || lowerTitle.includes('member')) categoryCode = 'followers';
      else if (lowerTitle.includes('reaction')) categoryCode = 'likes';
      else if (lowerTitle.includes('play') || lowerTitle.includes('traffic')) categoryCode = 'views';
      else if (lowerTitle.includes('save') || lowerTitle.includes('retweet')) categoryCode = 'shares';

      let markup = 3;
      if (categoryCode === 'views' && modalIDR < 1000) markup = 5;
      if (categoryCode === 'likes' && modalIDR < 1000) markup = 5;
      if (currentPlatform === 'YouTube' && categoryCode === 'views') markup = 3.5;
      if (currentPlatform === 'YouTube' && categoryCode === 'followers') markup = 3;
      if (currentPlatform === 'TikTok' && categoryCode === 'followers') markup = 4;
      if (currentPlatform === 'Instagram' && categoryCode === 'followers') markup = 3.5;
      
      let checkoutPrice = Math.round(modalIDR * markup);
      checkoutPrice = Math.ceil(checkoutPrice / 500) * 500;
      if (checkoutPrice < 1000) checkoutPrice = 1000;

      let badgeText = '';
      if (lowerTitle.includes('hq')) badgeText = 'High Quality';
      else if (lowerTitle.includes('auto')) badgeText = 'Auto Refill';
      else if (lowerTitle.includes('emergency')) badgeText = 'Prioritas';
      else if (checkoutPrice <= 2000) badgeText = 'Paling Murah';
      else badgeText = 'Rekomendasi';

      let tone = 'blue';
      if (currentPlatform === 'Instagram') tone = 'pink';
      if (currentPlatform === 'TikTok') tone = 'gray';
      if (currentPlatform === 'YouTube') tone = 'yellow';
      if (currentPlatform === 'Shopee') tone = 'orange';

      let refillStr = 'Tidak ada';
      if (isRefill || lowerTitle.includes('refill:')) {
        const m = title.match(/\[Refill: (.*?)\]/i);
        if (m) refillStr = m[1];
        else if (isRefill) refillStr = '30 hari';
      }

      let eta = '1-6 Jam';
      let startTime = '5-30 Menit';
      if (lowerTitle.includes('instan') || lowerTitle.includes('fast')) {
        eta = '1 Jam';
        startTime = 'Instan';
      }

      services.push({
        ProviderServiceID: providerServiceId,
        Title: title.replace(/"/g, '\\"'),
        CategoryCode: categoryCode,
        PlatformLabel: currentPlatform,
        CheckoutPrice: checkoutPrice,
        BadgeText: badgeText,
        Theme: tone,
        Refill: refillStr,
        StartTime: startTime,
        ETA: eta,
        MinOrder: minOrder,
        Code: 'jap-' + providerServiceId
      });
    }
  }
}

let goCode = `package main

import (
	"fmt"
	"log"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
)

func main() {
	cfg := config.Load()
	db := config.InitDB(cfg)

	services := []model.SosmedService{
`;

for (const s of services) {
  goCode += `		{
			CategoryCode:              "${s.CategoryCode}",
			Code:                      "${s.Code}",
			Title:                     "${s.Title}",
			ProviderCode:              "jap",
			ProviderServiceID:         "${s.ProviderServiceID}",
			ProviderTitle:             "${s.Title}",
			PlatformLabel:             "${s.PlatformLabel}",
			BadgeText:                 "${s.BadgeText}",
			Theme:                     "${s.Theme}",
			MinOrder:                  "${s.MinOrder}",
			StartTime:                 "${s.StartTime}",
			Refill:                    "${s.Refill}",
			ETA:                       "${s.ETA}",
			CheckoutPrice:             ${s.CheckoutPrice},
			SortOrder:                 100,
			IsActive:                  true,
		},
`;
}

goCode += `	}

	count := 0
	for _, s := range services {
		var existing model.SosmedService
		if err := db.Where("code = ?", s.Code).First(&existing).Error; err != nil {
			if err := db.Create(&s).Error; err != nil {
				log.Printf("Failed to insert %s: %v", s.Code, err)
			} else {
				count++
			}
		} else {
			existing.CheckoutPrice = s.CheckoutPrice
			existing.Title = s.Title
			db.Save(&existing)
		}
	}

	fmt.Printf("✓ Berhasil seed %d layanan JAP ke database!\n", count)
}
`;

fs.writeFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-api/cmd/seed_jap/main.go', goCode);
console.log("Generated cmd/seed_jap/main.go with", services.length, "services");
