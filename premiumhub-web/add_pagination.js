const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(public)', 'product', 'sosmed', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Icons
content = content.replace(/import \{\n  ArrowRight,\n  CheckCircle2,\n  Clock3,/g, 'import {\n  ArrowRight,\n  CheckCircle2,\n  ChevronLeft,\n  ChevronRight,\n  Clock3,');
content = content.replace(/import \{\r\n  ArrowRight,\r\n  CheckCircle2,\r\n  Clock3,/g, 'import {\r\n  ArrowRight,\r\n  CheckCircle2,\r\n  ChevronLeft,\r\n  ChevronRight,\r\n  Clock3,');

// 2. Map paginated cards
content = content.replace(
  /\{activeTab === 'satuan' && \(\r?\n\s*<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">\r?\n\s*\{cards.map\(\(service\) => \{/g,
  `{activeTab === 'satuan' && (
            <div className="space-y-8">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {paginatedCards.map((service) => {`
);

// 3. Add pagination buttons at the bottom of the map
content = content.replace(
  /<\/article>\r?\n\s*\)\r?\n\s*\}\)\}\r?\n\s*<\/div>\r?\n\s*\)\}/g,
  `                </article>
              )
            })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-1 flex-wrap">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={\`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all \${
                          currentPage === pageNum
                            ? 'bg-[#FF5733] text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-100'
                        }\`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          )}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Pagination injected!');
