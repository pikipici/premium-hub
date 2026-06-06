const fs=require('fs');
let c=fs.readFileSync('C:\\Users\\pikip\\Documents\\digimarket\\premium-hub\\premiumhub-web\\src\\components\\admin\\stok-page.tsx','utf8').replace(/\r\n/g,'\n');

// 1. Replace remaining status-badge spans
c=c.replace(/<span className=\{`status-badge \$\{(\w+)\.className\}`\}>/g, '<AdminStatusPill tone={$1.tone}>');
c=c.replace(/<\/span>\n\s+<\/td>\s*\n\s*<td>/g, '</AdminStatusPill>\n                        </td>\n                        <td>');

// 2. Now produk-page
let p=fs.readFileSync('C:\\Users\\pikip\\Documents\\digimarket\\premium-hub\\premiumhub-web\\src\\components\\admin\\produk-page.tsx','utf8').replace(/\r\n/g,'\n');

p=p.replace('<span className={`status-badge ${product.is_popular ? \'s-lunas\' : \'s-pending\'}`}>\n                            {product.is_popular ? \'Populer\' : \'Normal\'}\n                          </span>', '<AdminStatusPill tone={product.is_popular ? \'green\' : \'amber\'}>{product.is_popular ? \'Populer\' : \'Normal\'}</AdminStatusPill>');
p=p.replace('<span className={`status-badge ${product.is_active ? \'s-lunas\' : \'s-gagal\'}`}>\n                            {product.is_active ? \'Aktif\' : \'Nonaktif\'}\n                          </span>', '<AdminStatusPill tone={product.is_active ? \'green\' : \'red\'}>{product.is_active ? \'Aktif\' : \'Nonaktif\'}</AdminStatusPill>');

// Both desktop and mobile
while(p.includes('<span className={`status-badge')) {
  p=p.replace(/<span className=\{`status-badge \$\{(\w+)\.(\w+) \? 's-lunas' : 's-gagal'\}`\}>/g, '<AdminStatusPill tone={$1.$2 ? \'green\' : \'red\'}>');
  p=p.replace(/<span className=\{`status-badge \$\{(\w+)\.(\w+) \? 's-lunas' : 's-pending'\}`\}>/g, '<AdminStatusPill tone={$1.$2 ? \'green\' : \'amber\'}>');
  p=p.replace(/<\/span>/g, '</AdminStatusPill>');
  if(!p.includes('<span className={`status-badge')) break;
}

fs.writeFileSync('C:\\Users\\pikip\\Documents\\digimarket\\premium-hub\\premiumhub-web\\src\\components\\admin\\stok-page.tsx',c);
fs.writeFileSync('C:\\Users\\pikip\\Documents\\digimarket\\premium-hub\\premiumhub-web\\src\\components\\admin\\produk-page.tsx',p);
console.log('Pills replaced');
