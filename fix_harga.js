const fs = require('fs');
const file = 'premiumhub-web/src/components/admin/sosmed-service-settings-card.tsx';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(
  "<div style={{ fontWeight: 600 }}>{item.price_start || '-'}</div>",
  "<div style={{ fontWeight: 600 }}>{item.price_start || `Rp ${(item.checkout_price || 0).toLocaleString('id-ID')}/1K`}</div>"
);
fs.writeFileSync(file, data);
console.log('Fixed');
