const fs = require('fs');
let code = fs.readFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', 'utf8');

const regex = /\{cards\.map\(\(service\) => \{[\s\S]*?<\/article>\s*\n\s*\)\s*\}\)/m;

const newSatuanCards = `{cards.map((service) => {
              const checkoutHref = \`/product/sosmed/checkout?service=\${encodeURIComponent(service.code)}\`
              const ServiceIcon = iconForCategory(service.categoryCode)
              const isRecommended = service.isRecommended

              return (
                <article
                  key={service.key}
                  data-anime="sosmed-card"
                  className={\`group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl \${
                    isRecommended 
                      ? 'border-[#FF5733] bg-gradient-to-b from-[#FFF8F5] to-white ring-4 ring-[#FFD5C8]/30' 
                      : 'border-[#EAEAEA] bg-white hover:border-[#FF9B80]/50'
                  }\`}
                >
                  {isRecommended && (
                    <div className="absolute top-0 z-10 w-full bg-gradient-to-r from-[#FF5733] to-[#FF8C33] py-1 text-center text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                      Paling Direkomendasikan
                    </div>
                  )}

                  <div className={\`flex flex-col flex-grow p-6 \${isRecommended ? 'pt-8' : ''}\`}>
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className={\`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 \${service.tone}\`}>
                        <ServiceIcon className="h-6 w-6 text-[#141414]" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={\`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-wider \${
                          isRecommended ? 'bg-[#FF5733] text-white shadow-sm' : 'border border-[#EBEBEB] bg-gray-50 text-gray-500'
                        }\`}>
                          {service.platform}
                        </span>
                        {!isRecommended && (
                          <span className="rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[9px] font-bold text-[#FF5733]">
                            {service.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-[19px] font-extrabold leading-tight text-[#141414] group-hover:text-[#FF5733] transition-colors">{service.buyerTitle}</h2>
                      <p className="mt-2.5 text-[13px] leading-relaxed text-[#666] line-clamp-2">
                        {service.bestFor}
                      </p>
                    </div>

                    <div className="mt-6 mb-7">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[#141414] tracking-tight">{service.priceLabel}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#888]">{service.packageLabel}</span>
                    </div>

                    <div className="space-y-3.5 flex-grow">
                      {service.benefits.map((benefit) => (
                        <div key={\`\${service.key}-\${benefit}\`} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E8F8EC]">
                            <CheckCircle2 className="h-3 w-3 text-[#22A447]" />
                          </div>
                          <span className="text-[13px] font-medium text-[#444] leading-snug">{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-1.5 pt-5 border-t border-dashed border-gray-200">
                      {service.trustBadges.map((item) => (
                        <span
                          key={\`\${service.key}-\${item}\`}
                          className="rounded-lg bg-[#F8F8F8] px-2.5 py-1 text-[10px] font-bold text-[#777]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-0 border-t border-gray-100 bg-[#FAFAFA]">
                    <Link
                      href={checkoutHref}
                      className="inline-flex h-14 items-center justify-center text-[12px] font-bold text-[#666] transition hover:bg-gray-100 hover:text-[#141414]"
                    >
                      Detail Layanan
                    </Link>
                    <Link
                      href={checkoutHref}
                      className={\`inline-flex h-14 items-center justify-center gap-1.5 text-[12px] font-extrabold transition \${
                        isRecommended 
                          ? 'bg-[#FF5733] text-white hover:bg-[#E64A2E]' 
                          : 'bg-[#141414] text-white hover:bg-[#333]'
                      }\`}
                    >
                      Pilih Layanan <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              )
            })}`;

code = code.replace(regex, newSatuanCards);

fs.writeFileSync('c:/Users/pikip/Documents/digimatket/premium-hub/premiumhub-web/src/app/(public)/product/sosmed/page.tsx', code);
