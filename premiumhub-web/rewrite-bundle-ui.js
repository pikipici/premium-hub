const fs = require('fs');
let code = fs.readFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', 'utf8');

const regex = /function BundleCard\(\{ bundle \}: \{ bundle: SosmedBundleCard \}\) \{[\s\S]*?return \([\s\S]*?<\/article>\s*\n\s*\)\n\}/m;

if (!code.match(regex)) {
  console.error("COULD NOT MATCH REGEX");
  process.exit(1);
}

const newBundleCard = `function BundleCard({ bundle }: { bundle: SosmedBundleCard }) {
  // Default to mid-tier package if available, else first
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(bundle.packages.length > 1 ? 1 : 0)
  const BundleIcon = bundle.targetPlatform.toLowerCase().includes('tiktok') ? PlayCircle : Users
  const isSpecial = bundle.key === 'toko-online-pro'
  
  const selectedPkg = bundle.packages[selectedPkgIndex]
  
  return (
    <article
      data-anime="sosmed-card"
      className={\`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl \${
        isSpecial 
          ? 'border-[#FF5733] bg-gradient-to-b from-[#FFF8F5] to-white ring-4 ring-[#FFD5C8]/30' 
          : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
      }\`}
    >
      {isSpecial && (
        <div className="absolute top-0 z-10 w-full bg-gradient-to-r from-[#FF5733] to-[#FF8C33] py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
          Bundle Paling Direkomendasikan
        </div>
      )}

      <div className={\`flex flex-col flex-grow p-6 \${isSpecial ? 'pt-8' : ''}\`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className={\`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 \${bundle.tone}\`}>
            <BundleIcon className="h-6 w-6 text-[#141414]" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={\`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider \${
              isSpecial ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
            }\`}>
              {bundle.targetPlatform}
            </span>
            {!isSpecial && (
              <span className="rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[9px] font-bold text-[#FF5733]">
                {bundle.badge}
              </span>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-[19px] font-extrabold leading-tight text-[#141414] group-hover:text-[#FF5733] transition-colors">{bundle.title}</h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[#666]">
            {bundle.summary}
          </p>
        </div>

        <div className="mt-6 mb-7">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#A2572E]">Varian Paket Bundling</p>
          <div className="flex flex-col gap-2.5">
            {bundle.packages.map((pkg, i) => {
              const isSelected = selectedPkgIndex === i
              return (
                <div 
                  key={i} 
                  onClick={() => setSelectedPkgIndex(i)}
                  className={\`relative cursor-pointer flex items-center justify-between rounded-xl px-4 py-3 transition-all \${
                    isSelected 
                      ? 'border-2 border-[#FF5733] bg-[#FFF3EF] shadow-sm' 
                      : 'border border-[#EAEAEA] bg-white hover:border-[#FFD5C8]'
                  }\`}
                >
                  {isSelected && (
                    <div className="absolute -left-1.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#FF5733]" />
                  )}
                  <div>
                    <p className={\`text-xs font-bold \${isSelected ? 'text-[#141414]' : 'text-[#444]'}\`}>
                      {pkg.name}
                    </p>
                    <p className={\`mt-0.5 text-[10px] \${isSelected ? 'text-[#666]' : 'text-[#888]'}\`}>
                      {pkg.items.join(' + ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#141414]">{pkg.priceLabel}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-3.5 flex-grow">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A431D]">Layanan Termasuk:</p>
          {bundle.features.map((feat, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
              </div>
              <span className="text-[13px] font-medium text-[#444] leading-snug">{feat}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5 pt-5 border-t border-dashed border-gray-200">
          <span className="rounded-lg bg-[#F8F8F8] px-2.5 py-1 text-[10px] font-bold text-[#777]">
            Cocok untuk: {bundle.targetAudience}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-0 border-t border-gray-100 bg-[#FAFAFA]">
        <button
          onClick={() => alert('Fitur Checkout Bundling Segera Hadir!')}
          className="inline-flex h-14 items-center justify-center text-[12px] font-bold text-[#666] transition hover:bg-gray-100 hover:text-[#141414]"
        >
          Detail
        </button>
        <button
          onClick={() => alert('Fitur Checkout Bundling Segera Hadir!')}
          className={\`inline-flex h-14 items-center justify-center gap-1.5 text-[12px] font-extrabold transition \${
            isSpecial 
              ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]' 
              : 'bg-[#141414] text-white hover:bg-[#333]'
          }\`}
        >
          Pesan {selectedPkg.name} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}`;

code = code.replace(regex, newBundleCard);

fs.writeFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', code);
console.log("Successfully replaced bundle UI!");
