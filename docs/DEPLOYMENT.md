# Deployment

The production site is `https://uniscope-app.vercel.app` (Vercel project
`uniscope-app`, production branch `main`). The same Vite client is served as
static output; every `/api/*` request is handled by one Vercel Function that
wraps the Express app from `server/app.ts`.

## 1. Supabase (report storage)

1. Create a Supabase project and run [`supabase/schema.sql`](../supabase/schema.sql)
   in the SQL editor. It creates `public.reports`, enables RLS, and adds no
   public policies (the service role bypasses RLS).
2. Copy the project URL and the **service role** key (Settings → API) into the
   Vercel Production environment. Never expose the service role key to the
   browser.

If the table is missing, only the report endpoints fail (`/api/reports`,
`/api/admin/reports`); the read API and the PWA keep working.

## 2. Vercel environment variables (Production)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | e.g. `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side report reads/writes |
| `ADMIN_TOKEN` | admin review sign-in (at least 24 characters) |
| `TRUST_PROXY` | `1`, so Express reads the client IP from Vercel's proxy |

Optional:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_REPORTS_TABLE` | table name, defaults to `reports` |
| `ADMIN_SESSION_SECRET` | explicit HMAC secret; otherwise derived from `ADMIN_TOKEN` |
| `REPORT_STORE_DIR` | file-queue fallback directory when Supabase is absent |

## 3. Build settings

`vercel.json` pins the deployment shape:

- `api/index.ts` is the only Function. `vercel.json` rewrites `/api/:path*` to
  it and passes the original path as `__path`, which `server/vercel.ts`
  restores before Express routes the request.
- `includeFiles: data/build/**` bundles the 2.9 MB gzipped dataset
  (`institutions.json.gz`, `coverage.json`, `history.json`) with the Function.
  Without it the Function starts without data and `/api/health` returns 503.
- `memory: 1024` covers the in-memory dataset and search index (~250–400 MB);
  `maxDuration: 60` covers the first cold start while the dataset is parsed.
- `outputDirectory: dist` serves the built client, `manifest.webmanifest`,
  `sw.js` and icons as static files.

## 4. Verify a deployment

```bash
curl -s https://uniscope-app.vercel.app/api/health
# {"ok":true,...,"records":32210,"reportStorage":"supabase"}
curl -s 'https://uniscope-app.vercel.app/api/search?q=WIUT'
curl -sI https://uniscope-app.vercel.app/manifest.webmanifest
curl -sI https://uniscope-app.vercel.app/sw.js
```

The Vercel build log for the deployment shows the commit SHA under
**Deployments → the production deployment → Building**. The same deployment is
linked from the GitHub commit status (`context: Vercel`).

## 5. Local check without Vercel

```bash
npm ci --legacy-peer-deps
npm run build
NODE_ENV=production npm start   # http://127.0.0.1:3000/api/health
```

The local server keeps reports in `data/runtime/reports.jsonl` unless
`REPORT_STORE_DIR` points elsewhere. To exercise the serverless adapter:

```bash
npx tsx -e "import http from 'node:http'; import handler from './api/index.ts'; http.createServer((q,s)=>handler(q as never,s as never)).listen(8901)"
curl -s 'http://127.0.0.1:8901/api/index?__path=/api/health'
```
