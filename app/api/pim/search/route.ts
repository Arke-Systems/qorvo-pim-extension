import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PIM_API_BASE!;
const KEY = process.env.PIM_API_KEY!;
const BASIC_USER = process.env.PIM_BASIC_USER;
const BASIC_PASS = process.env.PIM_BASIC_PASS;
const MOCK = process.env.PIM_MOCK === '1';
const DEBUG = process.env.PIM_DEBUG === '1';
// Allow either a relative path (preferred, without leading slash) or a full URL override.
// Leading slashes would reset the path part when combined with a base that itself includes a path (e.g. .../ProductService.svc/), causing 404s.
const RAW_PRODUCTS_PATH = process.env.PIM_PRODUCTS_PATH || 'GetProductCatalogForSitecore';
const PRODUCTS_PATH = RAW_PRODUCTS_PATH.startsWith('http') ? RAW_PRODUCTS_PATH : RAW_PRODUCTS_PATH.replace(/^\/+/, '');
// Optional default query string fragment appended to endpoint (e.g. language=en&format=json)
const PRODUCTS_DEFAULT_QUERY = process.env.PIM_PRODUCTS_DEFAULT_QUERY || 'language=en&format=json';
// Cache settings: fetch full catalog once (endpoint returns all products) then filter in-memory.
const CACHE_TTL_MS = Number(process.env.PIM_CACHE_TTL_MS || 5 * 60 * 1000); // default 5 minutes
let catalogCache: { fetchedAt: number; items: any[] } | null = null;
let catalogFetchPromise: Promise<any[]> | null = null; // de-dupe concurrent fetches

// Generate a deterministic mock dataset (kept small for now)
function buildMockItems() {
  const cats = ['RF', 'Filters', 'Amplifiers'];
  const thumbFor: Record<string,string> = {
    'Filters': '/880060.jpg',      // "filter 880060.jpg"
    'Amplifiers': '/QPA2225_PDP.png', // "amplifier QPA2225_PDP.png"
    'RF': '/QM35825_PDP.png'       // "rf QM35825_PDP.png"
  };
  return Array.from({ length: 57 }).map((_,i) => {
    const category = cats[i % cats.length];
    return {
      id: `mock-${i+1}`,
      sku: `MCK-${(i+1).toString().padStart(3,'0')}`,
      name: `Mock Product ${(i+1)}`,
      category,
      thumbnailUrl: thumbFor[category] || ''
    };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limit = Number(searchParams.get('limit') || '20');
  const page = Number(searchParams.get('page') || '1');

  if (MOCK) {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (p: any) => {
      if (terms.length === 0) return true;
      const hay = [p.name, p.sku, p.category].map((s:string)=> (s||'').toLowerCase());
      return terms.every(t => hay.some(h => h.includes(t)));
    };
    const all = buildMockItems().filter(matches);
    const start = (page-1) * limit;
    const slice = all.slice(start, start+limit);
    return NextResponse.json({ total: all.length, items: slice });
  }

  if (!BASE) return NextResponse.json({ error: 'PIM_API_BASE not configured' }, { status: 500 });

  async function loadCatalog(): Promise<any[]> {
    // Fresh if cache exists and within TTL
    if (catalogCache && (Date.now() - catalogCache.fetchedAt) < CACHE_TTL_MS) {
      return catalogCache.items;
    }
    if (catalogFetchPromise) return catalogFetchPromise; // in-flight

    catalogFetchPromise = (async () => {
      let pimUrl: URL;
      if (PRODUCTS_PATH.startsWith('http')) {
        pimUrl = new URL(PRODUCTS_PATH);
      } else {
        const baseRoot = BASE.endsWith('/') ? BASE : BASE + '/';
        pimUrl = new URL(PRODUCTS_PATH, baseRoot);
      }
      if (PRODUCTS_DEFAULT_QUERY) {
        PRODUCTS_DEFAULT_QUERY.split('&').filter(Boolean).forEach(pair => {
          const [k,v] = pair.split('=');
          if (k) pimUrl.searchParams.set(k, v || '');
        });
      }
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (KEY) headers['Authorization'] = `Bearer ${KEY}`;
      if (BASIC_USER && BASIC_PASS) headers['Authorization'] = 'Basic ' + Buffer.from(`${BASIC_USER}:${BASIC_PASS}`).toString('base64');
      const res = await fetch(pimUrl.toString(), { headers, cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        const errPayload: any = { error: `Upstream PIM error ${res.status}`, details: text };
        if (DEBUG) errPayload.target = pimUrl.toString();
        throw new Error(JSON.stringify(errPayload));
      }
      const data = await res.json();
      // ProductCatalog model: top-level object with Products array, each having fields like UUID, PartNumber, Description, CategoryNames, etc.
      const rawList = Array.isArray(data) ? data
        : data.Products || data.products || data.items || data.results || data.productList || [];
      const stripHtml = (html: string | undefined) => html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim() : '';
      const normalized = rawList.map((x: any) => {
        const categoryNames: string = x.CategoryNames || x.categoryNames || '';
        const categories = categoryNames ? categoryNames.split(',').map((c: string)=>c.trim()).filter(Boolean) : [];
        return {
          id: x.UUID || x.uuid || x.id || x.ID || x.ProductId || x.ProductID,
          sku: x.PartNumber || x.partNumber || x.SKU || x.sku || '',
          name: stripHtml(x.Description) || x.Name || x.Title || 'Untitled',
          description: stripHtml(x.Description || x.Overview || ''),
            // Primary category is first; store all for filtering
          category: categories[0] || '',
          categories,
          // Placeholder - upstream doesn't appear to include direct image; keep heuristics
          thumbnailUrl: x.thumbnailUrl || x.image || x.ImageUrl || x.media?.[0]?.url || ''
        };
      });
      catalogCache = { fetchedAt: Date.now(), items: normalized };
      return normalized;
    })();

    try {
      const items = await catalogFetchPromise;
      return items;
    } finally {
      catalogFetchPromise = null; // allow refetch after resolution
    }
  }

  try {
    const catalog = await loadCatalog();
    // Filtering across name, sku, id, category (all lower-cased)
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length ? catalog.filter(p => {
      const hay = [p.name, p.sku, p.id, p.category].map(x => (x||'').toLowerCase());
      return terms.every(t => hay.some(h => h.includes(t)));
    }) : catalog;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);
    return NextResponse.json({ total, items: pageItems, cached: true, fetchedAt: catalogCache?.fetchedAt });
  } catch (e: any) {
    // If catalog load fails, surface structured payload when possible
    let message = e?.message || 'Catalog load failure';
    let structured: any = undefined;
    try { structured = JSON.parse(message); } catch {}
    if (structured && structured.error) {
      return NextResponse.json(structured, { status: 502 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
