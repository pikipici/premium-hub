const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(public)', 'product', 'sosmed', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state for activePlatform
content = content.replace(
  /const \[currentPage, setCurrentPage\] = useState\(1\)/,
  `const [currentPage, setCurrentPage] = useState(1)
  const [activePlatform, setActivePlatform] = useState('Semua')`
);

// 2. Add derived state for platforms and filteredCards, and update totalPages / paginatedCards
const derivedStateReplacement = `const cards = useMemo(() => buildSosmedServiceCards(services), [services])
  const platforms = useMemo(() => {
    const unique = Array.from(new Set(cards.map(c => c.platform)))
    return ['Semua', ...unique.sort()]
  }, [cards])

  const filteredCards = useMemo(() => {
    if (activePlatform === 'Semua') return cards
    return cards.filter(c => c.platform === activePlatform)
  }, [cards, activePlatform])

  const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE)
  const paginatedCards = filteredCards.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE)`;

content = content.replace(
  /const cards = useMemo\(\(\) => buildSosmedServiceCards\(services\), \[services\]\)\r?\n\s*const totalPages = Math\.ceil\(cards\.length \/ CARDS_PER_PAGE\)\r?\n\s*const paginatedCards = cards\.slice\(\(currentPage - 1\) \* CARDS_PER_PAGE, currentPage \* CARDS_PER_PAGE\)/,
  derivedStateReplacement
);

// 3. Update useEffect dependency
content = content.replace(
  /\}, \[paginatedCards\.length, currentPage, activeTab\]\)/,
  `}, [paginatedCards.length, currentPage, activeTab, activePlatform])`
);

// 4. Reset activePlatform when switching tabs to "satuan"
content = content.replace(
  /setActiveTab\('satuan'\)\r?\n\s*setCurrentPage\(1\)/,
  `setActiveTab('satuan')
                  setCurrentPage(1)
                  setActivePlatform('Semua')`
);

// 5. Add filter UI
const filterUI = `{activeTab === 'satuan' && (
            <div className="space-y-8">
              <div className="flex w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-2 mx-auto px-4">
                  {platforms.map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        setActivePlatform(p)
                        setCurrentPage(1)
                      }}
                      className={\`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all \${
                        activePlatform === p
                          ? 'bg-[#141414] text-white shadow-md'
                          : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 ring-1 ring-inset ring-gray-200'
                      }\`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">`;

content = content.replace(
  /\{activeTab === 'satuan' && \(\r?\n\s*<div className="space-y-8">\r?\n\s*<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">/,
  filterUI
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Platform filter injected!');
