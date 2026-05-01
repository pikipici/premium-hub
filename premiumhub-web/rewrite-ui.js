const fs = require('fs');
let code = fs.readFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', 'utf8');

code = code.replace(
  "import { BUNDLING_PACKAGES } from '@/lib/sosmedBundlingCards'",
  "import { BUNDLING_PACKAGES, type SosmedBundleCard } from '@/lib/sosmedBundlingCards'"
);

const bundleCardComponent = `
function BundleCard({ bundle }: { bundle: SosmedBundleCard }) {
  // Default to mid-tier package if available, else first
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(bundle.packages.length > 1 ? 1 : 0)
  const BundleIcon = bundle.targetPlatform.toLowerCase().includes('tiktok') ? PlayCircle : Users
  const isSpecial = bundle.key === 'toko-online-pro'
  
  const bgClass = isSpecial ? 'bg-gradient-to-b from-[#1E293B] to-[#0F172A] text-white border-transparent' : 'bg-white border-[#FFE2CF]'
  const titleClass = isSpecial ? 'text-white' : 'text-[#141414]'
  const textClass = isSpecial ? 'text-gray-300' : 'text-[#555]'
  const chipBg = isSpecial ? 'bg-[#334155] border-transparent text-white' : 'bg-white border-[#EBEBEB] text-[#555]'
  
  return (
    <article
      data-anime="sosmed-card"
      className={\`group relative flex h-full flex-col rounded-3xl border p-6 transition hover:-translate-y-0.5 hover:shadow-xl \${bgClass}\`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={\`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br \${bundle.tone}\`}>
          <BundleIcon className="h-6 w-6 text-[#141414]" />
        </div>
        <span className="rounded-full border border-[#FFD5C8] bg-[#FFF3EF] px-3 py-1 text-[11px] font-bold text-[#FF5733]">
          {bundle.badge}
        </span>
      </div>

      <div>
        <p className={\`text-[11px] font-semibold uppercase tracking-wide \${isSpecial ? 'text-gray-400' : 'text-[#777]'}\`}>{bundle.targetPlatform}</p>
        <h2 className={\`mt-1 text-2xl font-extrabold leading-tight \${titleClass}\`}>{bundle.title}</h2>
        <p className={\`mt-2 text-sm leading-relaxed \${textClass}\`}>{bundle.summary}</p>
        <p className={\`mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed border \${isSpecial ? 'bg-[#1E293B] border-gray-700 text-gray-200' : 'bg-[#FAFAF8] border-[#F0F0F0] text-[#444]'}\`}>
          <span className="font-bold text-[#FF5733]">Cocok Untuk:</span> {bundle.targetAudience}
        </p>
      </div>

      <div className="mt-5">
        <p className={\`text-[11px] font-bold uppercase tracking-wide \${isSpecial ? 'text-orange-400' : 'text-[#8A431D]'}\`}>Layanan Termasuk:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {bundle.features.map((feat, i) => (
            <span key={i} className={\`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wide \${chipBg}\`}>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#22A447]" />
              {feat}
            </span>
          ))}
        </div>
      </div>

      <div className={\`mt-6 rounded-2xl border p-4 \${isSpecial ? 'bg-[#0F172A] border-gray-700' : 'bg-[#FFF6F2] border-[#FFD5C8]'}\`}>
        <p className={\`mb-3 text-[11px] font-bold uppercase tracking-wide \${isSpecial ? 'text-gray-400' : 'text-[#A2572E]'}\`}>Pilih Varian Paket</p>
        <div className="flex flex-col gap-3">
          {bundle.packages.map((pkg, i) => {
            const isSelected = selectedPkgIndex === i
            return (
              <div 
                key={i} 
                onClick={() => setSelectedPkgIndex(i)}
                className={\`relative cursor-pointer flex items-center justify-between rounded-xl px-4 py-3 transition-all \${
                  isSelected 
                    ? 'border-2 border-[#FF5733] bg-[#FFF3EF] shadow-sm' 
                    : isSpecial ? 'border border-gray-700 bg-[#1E293B] hover:border-gray-500' : 'border border-[#EBEBEB] bg-white hover:border-[#FFD5C8]'
                }\`}
              >
                {isSelected && (
                  <div className="absolute -left-1.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-[#FF5733]" />
                )}
                <div>
                  <p className={\`text-xs font-bold \${isSelected ? 'text-[#141414]' : isSpecial ? 'text-gray-200' : 'text-[#141414]'}\`}>
                    {pkg.name}
                  </p>
                  <p className={\`mt-0.5 text-[10px] \${isSelected ? 'text-[#666]' : isSpecial ? 'text-gray-400' : 'text-[#666]'}\`}>
                    {pkg.items.join(' + ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#FF5733]">{pkg.priceLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={() => alert('Fitur Checkout Bundling Segera Hadir!')}
          className={\`w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-sm font-bold transition \${
            isSpecial 
              ? 'bg-[#FF5733] text-white hover:bg-[#e64d2e]' 
              : 'bg-[#141414] text-white hover:bg-[#333]'
          }\`}
        >
          Pesan Paket {bundle.packages[selectedPkgIndex].name} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

export default function ProductSosmedLandingPage()`;

code = code.replace("export default function ProductSosmedLandingPage()", bundleCardComponent);

const newBundlingSection = `{activeTab === 'bundling' && (
            <div className="grid gap-6 md:grid-cols-2">
              {BUNDLING_PACKAGES.map((bundle) => (
                <BundleCard key={bundle.key} bundle={bundle} />
              ))}
            </div>
          )}`;

const regex = /\{activeTab === 'bundling' && \([\s\S]*?<\/div>\s*\)\}/m;
code = code.replace(regex, newBundlingSection);

fs.writeFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', code);
