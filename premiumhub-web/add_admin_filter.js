const fs = require('fs');

const file = 'src/components/admin/sosmed-service-settings-card.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `  const [importJAPPreview, setImportJAPPreview] = useState<AdminSosmedImportJAPPreviewResult | null>(null)
  const [previewingJAP, setPreviewingJAP] = useState(false)

  const categoryOptions = useMemo(`;
const repl1 = `  const [importJAPPreview, setImportJAPPreview] = useState<AdminSosmedImportJAPPreviewResult | null>(null)
  const [previewingJAP, setPreviewingJAP] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [activePlatformFilter, setActivePlatformFilter] = useState('All')

  const categoryOptions = useMemo(`;

const target2 = `  const categoryLabelMap = useMemo(() => {
    return categoryOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.code] = item.label || item.code
      return acc
    }, {})
  }, [categoryOptions])

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftSort = left.sort_order ?? 100
        const rightSort = right.sort_order ?? 100
        if (leftSort !== rightSort) return leftSort - rightSort
        return (left.code || '').localeCompare(right.code || '')
      }),
    [items]
  )`;
const repl2 = `  const categoryLabelMap = useMemo(() => {
    return categoryOptions.reduce<Record<string, string>>((acc, item) => {
      acc[item.code] = item.label || item.code
      return acc
    }, {})
  }, [categoryOptions])

  const platformFilterOptions = useMemo(() => {
    const platforms = new Set<string>()
    items.forEach(item => {
      if (item.platform_label) platforms.add(item.platform_label)
    })
    return ['All', ...Array.from(platforms).sort()]
  }, [items])

  const sortedItems = useMemo(
    () => {
      let result = [...items]
      if (activePlatformFilter !== 'All') {
        result = result.filter(item => item.platform_label === activePlatformFilter)
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        result = result.filter(item => 
          (item.title || '').toLowerCase().includes(q) ||
          (item.code || '').toLowerCase().includes(q) ||
          (item.platform_label || '').toLowerCase().includes(q)
        )
      }
      return result.sort((left, right) => {
        const leftSort = left.sort_order ?? 100
        const rightSort = right.sort_order ?? 100
        if (leftSort !== rightSort) return leftSort - rightSort
        return (left.code || '').localeCompare(right.code || '')
      })
    },
    [items, activePlatformFilter, searchQuery]
  )`;

const target3 = `        {(error || notice) && (
          <div style={{ padding: '0 18px 12px' }}>
            {error && (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}
            {notice && <div className="alert success">{notice}</div>}
          </div>
        )}

        <div style={{ padding: '0 18px 18px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat layanan sosmed...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada layanan sosmed.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>`;
const repl3 = `        {(error || notice) && (
          <div style={{ padding: '0 18px 12px' }}>
            {error && (
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>
                {error}
              </div>
            )}
            {notice && <div className="alert success">{notice}</div>}
          </div>
        )}

        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: 220 }}
              placeholder="Cari nama/kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: 180 }}
              value={activePlatformFilter}
              onChange={(e) => setActivePlatformFilter(e.target.value)}
            >
              {platformFilterOptions.map(p => (
                <option key={p} value={p}>{p === 'All' ? 'Semua Platform' : p}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat layanan sosmed...</div>
          ) : sortedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Tidak ada layanan sosmed yang sesuai pencarian.</div>
          ) : (
            <div className="table-wrap" style={{ overflowX: 'auto' }}>`;

function normalizeSpaces(str) {
  return str.replace(/\r\n/g, '\n').trim();
}

let changed = false;

[
  { t: target1, r: repl1 },
  { t: target2, r: repl2 },
  { t: target3, r: repl3 },
].forEach(({ t, r }, i) => {
  const normContent = normalizeSpaces(content);
  const normTarget = normalizeSpaces(t);
  
  if (normContent.includes(normTarget)) {
    // Escape regex characters from target
    const escapedTarget = normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace using regex handling arbitrary whitespace
    const regex = new RegExp(escapedTarget.replace(/\\n/g, '\\s+').replace(/\\s\+/g, '\\s+'), 'g');
    content = content.replace(regex, r);
    changed = true;
    console.log('Replaced chunk', i+1);
  } else {
    console.log('Target not found', i+1);
  }
});

if (changed) {
  fs.writeFileSync(file, content);
  console.log('Saved changes!');
} else {
  console.log('No changes made.');
}
