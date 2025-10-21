import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.PIM_API_BASE!;
const KEY = process.env.PIM_API_KEY!;
const BASIC_USER = process.env.PIM_BASIC_USER;
const BASIC_PASS = process.env.PIM_BASIC_PASS;
const MOCK = process.env.PIM_MOCK === '1';
const DEBUG = process.env.PIM_DEBUG === '1';
// If enabled, when real PIM mode is active and the upstream network request itself fails (not just a non-2xx response),
// we will fall back to serving mock data so the UI remains usable. This never triggers for upstream HTTP error codes.
const FALLBACK_TO_MOCK = process.env.PIM_FALLBACK_TO_MOCK === '1';
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
      partNumber: `MCK-${(i+1).toString().padStart(3,'0')}`,
      description: `Mock Product ${(i+1)}`,
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
  const allowOrigin = process.env.PIM_ALLOW_ORIGIN; // Optional specific origin for CORS
  const corsHeaders: Record<string,string> = allowOrigin ? {
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin'
  } : {};

  if (MOCK) {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (p: any) => {
      if (terms.length === 0) return true;
      const hay = [p.partNumber, p.description, p.id, p.category].map((s:string)=> (s||'').toLowerCase());
      return terms.every(t => hay.some(h => h.includes(t)));
    };
    const all = buildMockItems().filter(matches);
    const start = (page-1) * limit;
    const slice = all.slice(start, start+limit);
    return NextResponse.json({ total: all.length, items: slice }, { headers: corsHeaders });
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
      let res: Response;
      try {
        res = await fetch(pimUrl.toString(), { headers, cache: 'no-store' });
      } catch (netErr: any) {
        // Network-level failure (DNS, ECONNREFUSED, timeout, etc.)
        if (FALLBACK_TO_MOCK) {
          if (DEBUG) {
            console.error('[PIM] Network error contacting upstream, using mock fallback', {
              message: netErr?.message,
              code: netErr?.code,
              errno: netErr?.errno,
              syscall: netErr?.syscall,
              address: netErr?.address,
              target: pimUrl.toString()
            });
          }
          // Build & cache mock so subsequent queries reuse it (simulate catalog fetch)
          const mockItems = buildMockItems();
          catalogCache = { fetchedAt: Date.now(), items: mockItems };
          return mockItems;
        }
        const errPayload: any = { error: 'Upstream network failure', message: netErr?.message || String(netErr) };
        ['code','errno','syscall','address'].forEach(k => { if (netErr && netErr[k]) errPayload[k] = netErr[k]; });
        if (DEBUG) errPayload.target = pimUrl.toString();
        throw new Error(JSON.stringify(errPayload));
      }
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
          description: stripHtml(x.Description || x.Overview || ''),
          category: categories[0] || '',
          categories,
          // Placeholder - upstream doesn't appear to include direct image; keep heuristics
          thumbnailUrl: x.thumbnailUrl || x.image || x.ImageUrl || x.media?.[0]?.url || '',
          uuid: x.UUID || x.uuid || undefined,
          partNumber: x.PartNumber || x.partNumber || undefined,
          productType: x.ProductType ? { UUID: x.ProductType.UUID || x.ProductType.uuid, Name: x.ProductType.Name || x.ProductType.name } : null
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
    // Filtering across partNumber, description, id, category (all lower-cased)
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length ? catalog.filter(p => {
      const hay = [p.partNumber, p.description, p.id, p.category].map(x => (x||'').toLowerCase());
      return terms.every(t => hay.some(h => h.includes(t)));
    }) : catalog;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);
    return NextResponse.json({ total, items: pageItems, cached: true, fetchedAt: catalogCache?.fetchedAt }, { headers: corsHeaders });
  } catch (e: any) {
    // If catalog load fails, surface structured payload when possible
    let message = e?.message || 'Catalog load failure';
    let structured: any = undefined;
    try { structured = JSON.parse(message); } catch {}
    if (structured && structured.error) {
      return NextResponse.json(structured, { status: 502, headers: corsHeaders });
    }
    return NextResponse.json({ error: message }, { status: 502, headers: corsHeaders });
  }
}
