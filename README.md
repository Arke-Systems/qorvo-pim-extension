# Qorvo PIM Browser – Contentstack Field Extension (Next.js)

This app renders inside Contentstack’s entry editor as a **Custom Field** allowing editors to search/browse the Qorvo PIM and select one or multiple products. Selected value(s) are stored directly in the entry as JSON.

## Features

- Single or multi-select (`multi` flag)
- Debounced search with pagination
- Server-side proxy protects PIM credentials
- Configurable display fields & default filters
- Minimal, framework-friendly structure (Next.js App Router)

## Getting Started

```bash
cp .env.example .env.local
# Edit .env.local with real PIM values
npm install # or pnpm install
npm run dev
```

Local dev URL: `http://localhost:3000/extension`

If Contentstack cannot reach localhost directly, expose with a tunnel (ngrok/cloudflared) and configure the Custom Field to that public `/extension` URL.

## Environment Variables

See `.env.example`.

### Real PIM Endpoint Configuration

You can customize the upstream product fetch endpoint without code changes:

| Variable                     | Purpose                                                                   | Default                        |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `PIM_API_BASE`               | Base origin or service root. Trailing slash recommended if path appended. | (example in `.env.example`)    |
| `PIM_PRODUCTS_PATH`          | Path appended to base for product catalog (omit leading slash).           | `GetProductCatalogForSitecore` |
| `PIM_PRODUCTS_DEFAULT_QUERY` | Static query string appended (e.g. `language=en&format=json`).            | `language=en&format=json`      |

The proxy will call: `BASE + PIM_PRODUCTS_PATH + '?' + PIM_PRODUCTS_DEFAULT_QUERY`. Search/page/limit parameters are sent only as harmless hints; for the `GetProductCatalogForSitecore` endpoint (which returns the full catalog) the proxy fetches everything once, caches it in-memory, and then performs filtering & pagination locally.

#### Catalog Caching

Because `GetProductCatalogForSitecore` returns the full dataset with no server paging/search, the API route caches the normalized catalog for a configurable TTL (default 5 minutes via `PIM_CACHE_TTL_MS`). Responses include:

```json
{
  "total": 1234,
  "items": [ ... page slice ... ],
  "cached": true,
  "fetchedAt": 1712345678901
}
```

Set `PIM_DEBUG=1` to see the upstream target URL on errors.

### ProductCatalog Model Mapping

Upstream fields are mapped as follows:

| Upstream Field       | Normalized Field          | Notes                                                                                                                                    |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `UUID`               | `id`                      | Primary identifier                                                                                                                       |
| `PartNumber`         | `sku`                     | Stored exactly                                                                                                                           |
| `Description` (HTML) | `name` / `description`    | HTML stripped. `name` uses stripped Description (fallbacks to `Title`/`Name`). `description` retains same stripped text (or `Overview`). |
| `CategoryNames`      | `category` / `categories` | Comma-delimited string split into array; `category` is first element.                                                                    |
| (image fields TBD)   | `thumbnailUrl`            | Placeholder heuristic (no direct image in sample)                                                                                        |

Additional upstream fields are preserved on the stored object so you can surface them later.

### Mock Mode

If you do not have a reachable PIM API yet, enable an in-memory mock dataset:

```
PIM_MOCK=1
```

With mock mode on, `/api/pim/search` serves 57 deterministic fake products supporting `q`, `limit`, and `page` so you can develop the UI without real backend connectivity.

Mock thumbnails use local `/public` assets:

| Category   | File               |
| ---------- | ------------------ |
| Filters    | `/880060.jpg`      |
| Amplifiers | `/QPA2225_PDP.png` |
| RF         | `/QM35825_PDP.png` |

Turn mock mode off (`PIM_MOCK=0`) before deploying.

## Register in Contentstack

Config JSON example:

```json
{
  "multi": true,
  "displayFields": ["name", "sku"],
  "filters": { "category": "RF Solutions" }
}
```

## Data Stored

Single:

```json
{
  "id": "pa000372",
  "sku": "854550-1",
  "name": "69.99 MHz IF SAW Filter - CDMA Base Station",
  "description": "69.99 MHz IF SAW Filter - CDMA Base Station",
  "category": "Defense & Aerospace",
  "categories": [
    "Defense & Aerospace",
    "Communications",
    "Network Infrastructure",
    "Point-to-Point Radio",
    "Wireless Infrastructure",
    "Base Stations"
  ],
  "thumbnailUrl": "",
  "PartNumber": "854550-1", // original fields also present
  "UUID": "pa000372"
}
```

Multi:

```json
[
  {
    "id": "pa000372",
    "sku": "854550-1",
    "name": "69.99 MHz IF SAW Filter - CDMA Base Station",
    "category": "Defense & Aerospace"
  }
]
```

## Deploy

- Vercel: import repo, set env vars, default build.
- Netlify: use Next 14 adapter support.

## Security Notes

- Frame embedding controlled via `frame-ancestors` header in `next.config.mjs`.
- Avoid logging secrets. Add rate limiting or caching if needed.

## Future Enhancements

- Faceted filtering UI
- Product detail drawer
- Infinite scroll
- Bulk selection actions

## Troubleshooting

- No results: check Network tab `/api/pim/search` response
- Iframe blocked: adjust CSP header
- Value not saving: ensure field type is JSON/Text and `sdk.field.setData` is invoked
