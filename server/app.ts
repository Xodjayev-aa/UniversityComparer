import { existsSync } from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { summarize, type DataStore } from './data';
import { buildFacets, parseSearchParams, searchStore } from './search';
import { ReportStore, type CorrectionReport } from './reports';
import {
  adminIsConfigured,
  clearSessionCookie,
  createSession,
  hasValidSession,
  sameOrigin,
  secureEquals,
  sessionCookieAttributes,
} from './admin';

export interface CreateAppOptions {
  store?: DataStore | null;
  dataError?: Error | null;
  reportStoreDir?: string;
  adminToken?: string | null;
  distDir?: string;
  version?: string;
}

const INSTITUTION_ID = /^[a-z0-9][a-z0-9-]{3,90}$/;
const REPORT_FIELDS = [
  'name',
  'city',
  'website',
  'programs',
  'tuition',
  'deadlines',
  'admissions',
  'recognition',
  'scholarships',
  'coverage',
  'other',
] as const;

const reportSchema = z.object({
  issueType: z.enum(['incorrect', 'outdated', 'missing', 'source-problem', 'other']),
  field: z.enum(REPORT_FIELDS),
  details: z.string().trim().min(10, 'Describe the issue in at least 10 characters').max(2000),
  institutionId: z.string().max(90).nullish(),
  pageUrl: z
    .string()
    .max(300)
    .nullish()
    .refine((value) => !value || (value.startsWith('/') && !value.startsWith('//')), 'Page URL must be a site-relative path'),
  sourceUrl: z
    .string()
    .max(500)
    .nullish()
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Source URL must be an absolute http(s) link'),
  email: z
    .string()
    .max(200)
    .nullish()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email or leave it blank'),
  website: z.string().max(200).optional(),
});

const adminLoginSchema = z.object({ token: z.string().min(1).max(300) });
const adminUpdateSchema = z.object({ status: z.enum(['new', 'reviewing', 'resolved', 'rejected']) });

class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): { ok: boolean; remaining: number; retryAfter: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, remaining: 0, retryAfter: Math.ceil((recent[0]! + this.windowMs - now) / 1000) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) {
      for (const [mapKey, times] of this.hits) {
        if (times.every((time) => time <= cutoff)) this.hits.delete(mapKey);
      }
    }
    return { ok: true, remaining: this.limit - recent.length, retryAfter: 0 };
  }
}

function apiError(res: Response, status: number, error: string, detail?: string): void {
  res.status(status).json(detail ? { error, detail } : { error });
}

function cleanText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

function queryParams(req: Request): URLSearchParams {
  const index = req.originalUrl.indexOf('?');
  return new URLSearchParams(index === -1 ? '' : req.originalUrl.slice(index + 1));
}

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const store = options.store ?? null;
  const dataError = options.dataError ?? null;
  const version = options.version ?? '0.1.0';
  const adminToken = options.adminToken ?? process.env.ADMIN_TOKEN ?? null;
  const reportStore = new ReportStore(
    options.reportStoreDir ?? process.env.REPORT_STORE_DIR ?? path.resolve(process.cwd(), 'data', 'runtime'),
  );
  const distDir = path.resolve(options.distDir ?? path.join(process.cwd(), 'dist'));
  const isProduction = process.env.NODE_ENV === 'production';

  const searchLimiter = new RateLimiter(240, 60_000);
  const reportLimiter = new RateLimiter(5, 60 * 60_000);
  const adminLoginLimiter = new RateLimiter(10, 15 * 60_000);

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              manifestSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '32kb', strict: true }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  const requireStore = (res: Response): DataStore | null => {
    if (store) return store;
    apiError(
      res,
      503,
      'The data release is not available on this server.',
      dataError?.message ?? 'Run the ingestion build and restart the server.',
    );
    return null;
  };

  /* -------------------------------- health ------------------------------ */

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(store ? 200 : 503).json({
      ok: Boolean(store),
      version,
      generatedAt: store?.dataset.generatedAt ?? null,
      records: store?.dataset.institutions.length ?? 0,
      dataDir: store?.dataDir ?? '',
    });
  });

  /* ------------------------------ read APIs ----------------------------- */

  app.get('/api/meta', (_req, res) => {
    const active = requireStore(res);
    if (!active) return;
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      app: 'UniScope',
      version,
      generatedAt: active.dataset.generatedAt,
      coverage: active.coverage,
      sources: active.dataset.sources,
    });
  });

  app.get('/api/coverage', (_req, res) => {
    const active = requireStore(res);
    if (!active) return;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(active.coverage);
  });

  app.get('/api/sources', (_req, res) => {
    const active = requireStore(res);
    if (!active) return;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ sources: active.dataset.sources });
  });

  app.get('/api/facets', (_req, res) => {
    const active = requireStore(res);
    if (!active) return;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(buildFacets(active));
  });

  app.get('/api/search', (req, res) => {
    const active = requireStore(res);
    if (!active) return;
    const limited = searchLimiter.consume(clientKey(req));
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfter));
      apiError(res, 429, 'Too many search requests. Please wait a moment.');
      return;
    }
    const input = parseSearchParams(queryParams(req));
    res.setHeader('Cache-Control', 'no-store');
    res.json(searchStore(active, input));
  });

  app.get('/api/institutions/:id', (req, res) => {
    const active = requireStore(res);
    if (!active) return;
    const id = req.params.id ?? '';
    if (!INSTITUTION_ID.test(id)) {
      apiError(res, 400, 'Invalid institution id.');
      return;
    }
    const record = active.byId.get(id);
    if (!record) {
      apiError(res, 404, 'Institution not found in this data release.');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({ institution: record, summary: summarizeRecord(active, record) });
  });

  app.get('/api/compare', (req, res) => {
    const active = requireStore(res);
    if (!active) return;
    const raw = (queryParams(req).get('ids') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const ids = [...new Set(raw)];
    if (ids.length < 2 || ids.length > 4) {
      apiError(res, 400, 'Choose between 2 and 4 institution ids.');
      return;
    }
    const invalid = ids.find((id) => !INSTITUTION_ID.test(id));
    if (invalid) {
      apiError(res, 400, 'Invalid institution id.', invalid);
      return;
    }
    const missing = ids.filter((id) => !active.byId.has(id));
    if (missing.length > 0) {
      apiError(res, 404, 'One or more institutions are not in this data release.', missing.join(', '));
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json({
      items: ids.map((id) => {
        const record = active.byId.get(id)!;
        return { institution: record, summary: summarizeRecord(active, record) };
      }),
    });
  });

  /* ------------------------------- reports ------------------------------ */

  app.post('/api/reports', async (req, res) => {
    const limited = reportLimiter.consume(clientKey(req));
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfter));
      apiError(res, 429, 'Too many reports from this connection. Please try again later.');
      return;
    }
    const parsed = reportSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      apiError(res, 400, 'The report could not be validated.', parsed.error.issues[0]?.message);
      return;
    }
    const input = parsed.data;
    if (input.website) {
      // Honeypot: behave like success without storing anything.
      res.status(202).json({ ok: true });
      return;
    }
    const record = input.institutionId ? store?.byId.get(input.institutionId) ?? null : null;
    try {
      const report = await reportStore.append({
        issueType: input.issueType,
        field: input.field,
        details: cleanText(input.details),
        institutionId: input.institutionId ?? null,
        institutionName: record?.names.primary ?? null,
        pageUrl: input.pageUrl ?? null,
        sourceUrl: input.sourceUrl ?? null,
        email: input.email?.trim() || null,
      });
      res.status(201).json({ ok: true, reference: report.id.slice(0, 8).toUpperCase() });
    } catch {
      apiError(res, 500, 'The report could not be stored. Please try again later.');
    }
  });

  /* -------------------------------- admin ------------------------------- */

  const adminGuard = (req: Request, res: Response): boolean => {
    if (!adminIsConfigured(adminToken)) {
      apiError(res, 503, 'Admin review is not configured on this deployment.');
      return false;
    }
    if (!hasValidSession(req, adminToken)) {
      apiError(res, 401, 'Admin sign-in required.');
      return false;
    }
    return true;
  };

  app.get('/api/admin/session', (req, res) => {
    if (!adminIsConfigured(adminToken)) {
      apiError(res, 503, 'Admin review is not configured on this deployment.');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ configured: true, authenticated: hasValidSession(req, adminToken) });
  });

  app.post('/api/admin/session', (req, res) => {
    if (!adminIsConfigured(adminToken)) {
      apiError(res, 503, 'Admin review is not configured on this deployment.');
      return;
    }
    if (!sameOrigin(req)) {
      apiError(res, 403, 'Cross-origin request rejected.');
      return;
    }
    const limited = adminLoginLimiter.consume(clientKey(req));
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfter));
      apiError(res, 429, 'Too many sign-in attempts.');
      return;
    }
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success || !secureEquals(parsed.data.token, adminToken)) {
      apiError(res, 401, 'Sign-in failed.');
      return;
    }
    const session = createSession(adminToken);
    res.setHeader('Set-Cookie', `${session.cookie}; ${sessionCookieAttributes(session.maxAge)}`);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  app.delete('/api/admin/session', (req, res) => {
    if (!sameOrigin(req)) {
      apiError(res, 403, 'Cross-origin request rejected.');
      return;
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  });

  app.get('/api/admin/reports', async (req, res) => {
    if (!adminGuard(req, res)) return;
    try {
      const reports = await reportStore.list();
      res.setHeader('Cache-Control', 'no-store');
      res.json({ reports });
    } catch {
      apiError(res, 500, 'The review queue could not be read.');
    }
  });

  app.patch('/api/admin/reports/:id', async (req, res) => {
    if (!adminGuard(req, res)) return;
    if (!sameOrigin(req)) {
      apiError(res, 403, 'Cross-origin request rejected.');
      return;
    }
    const parsed = adminUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      apiError(res, 400, 'Invalid report status.');
      return;
    }
    try {
      const updated = await reportStore.update(req.params.id ?? '', {
        status: parsed.data.status as CorrectionReport['status'],
      });
      if (!updated) {
        apiError(res, 404, 'Report not found.');
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ report: updated });
    } catch {
      apiError(res, 500, 'The report could not be updated.');
    }
  });

  app.use('/api', (_req, res) => {
    apiError(res, 404, 'API route not found.');
  });

  /* ------------------------------ static app ---------------------------- */

  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  const indexFile = path.join(distDir, 'index.html');
  const hasClientBuild = existsSync(indexFile);
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (!hasClientBuild) {
      res
        .status(503)
        .type('text/plain')
        .send('The web client has not been built. Run “npm run build”, or use “npm run dev” with the Vite dev server.');
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile, (error) => {
      if (error) next(error);
    });
  });

  app.use((_req, res) => {
    apiError(res, 404, 'Not found.');
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const maybe = error as { type?: string; status?: number; message?: string };
    if (maybe.type === 'entity.too.large') {
      apiError(res, 413, 'Request body is too large.');
      return;
    }
    if (maybe.type === 'entity.parse.failed') {
      apiError(res, 400, 'Request body must be valid JSON.');
      return;
    }
    console.error('[api] unhandled error:', maybe.message ?? error);
    apiError(res, 500, 'Something went wrong on the server.');
  });

  return app;
}

function summarizeRecord(_store: DataStore, record: import('../shared/types').Institution) {
  return summarize(record);
}
