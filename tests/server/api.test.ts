import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';
import { makeFixtureStore } from '../helpers/fixtures';

let reportDir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  delete process.env.ADMIN_TOKEN;
  reportDir = mkdtempSync(path.join(tmpdir(), 'uniscope-reports-'));
  app = createApp({
    store: makeFixtureStore(),
    reportStoreDir: reportDir,
    distDir: path.join(reportDir, 'no-dist'),
    adminToken: undefined,
  });
});

afterAll(() => {
  rmSync(reportDir, { recursive: true, force: true });
});

describe('read API', () => {
  it('reports health and dataset counts', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ ok: true, records: 5, dataDir: 'fixtures' });
  });

  it('serves coverage and metadata without claiming completeness', async () => {
    const coverage = await request(app).get('/api/coverage').expect(200);
    expect(coverage.body.totals.records).toBe(5);
    expect(coverage.body.gaps.join(' ')).toMatch(/not a complete world register/i);
    const meta = await request(app).get('/api/meta').expect(200);
    expect(meta.body.app).toBe('UniScope');
    expect(meta.body.coverage.totals.sourceChecked).toBe(2);
  });

  it('searches with Unicode and filters, and withholds unknown data explicitly', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ q: 'montreal', scope: 'university' })
      .expect(200);
    expect(response.body.items[0].name).toBe('Université de Montréal');

    const filtered = await request(app)
      .get('/api/search')
      .query({ degree: 'bachelor', scope: 'all' })
      .expect(200);
    expect(filtered.body.withheld.programDataUnknown).toBe(3);
    expect(filtered.body.notices.join(' ')).toMatch(/unknown, not evidence/i);
  });

  it('returns a full institution, 404 for unknown ids, and 400 for invalid ids', async () => {
    const detail = await request(app).get('/api/institutions/ror-example-one').expect(200);
    expect(detail.body.institution.names.primary).toBe('Example University One');
    expect(detail.body.institution.tuition[0].amount.currency).toBe('GBP');
    await request(app).get('/api/institutions/ror-nope').expect(404);
    await request(app).get('/api/institutions/BAD_ID').expect(400);
  });

  it('compares 2–4 institutions and rejects fewer, more, or unknown ids', async () => {
    const two = await request(app)
      .get('/api/compare')
      .query({ ids: 'ror-example-one,ror-example-two' })
      .expect(200);
    expect(two.body.items).toHaveLength(2);
    expect(two.body.items.map((item: { summary: { id: string } }) => item.summary.id)).toEqual([
      'ror-example-one',
      'ror-example-two',
    ]);
    await request(app).get('/api/compare').query({ ids: 'ror-example-one' }).expect(400);
    await request(app)
      .get('/api/compare')
      .query({ ids: 'a1,b2,c3,d4,e5' })
      .expect(400);
    await request(app).get('/api/compare').query({ ids: 'ror-example-one,ror-nope' }).expect(404);
  });

  it('serves facets and an explicit JSON 404 for unknown API routes', async () => {
    const facets = await request(app).get('/api/facets').expect(200);
    expect(facets.body.countries.find((country: { code: string }) => country.code === 'CA').universityRecords).toBe(2);
    const missing = await request(app).get('/api/nope').expect(404);
    expect(missing.body.error).toMatch(/API route not found/);
  });
});

describe('correction reports', () => {
  it('rejects invalid input with a useful message', async () => {
    const response = await request(app)
      .post('/api/reports')
      .send({ issueType: 'incorrect', field: 'tuition', details: 'short' })
      .expect(400);
    expect(response.body.error).toMatch(/validated/);
    expect(response.body.detail).toMatch(/at least 10/);
  });

  it('accepts a valid report, stores it, and returns a reference without promising review', async () => {
    const response = await request(app)
      .post('/api/reports')
      .send({
        issueType: 'outdated',
        field: 'tuition',
        details: 'The page now lists a different fee for 2027 entry.',
        institutionId: 'ror-example-one',
        pageUrl: '/university/ror-example-one',
        sourceUrl: 'https://example.edu/fees',
      })
      .expect(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.reference).toMatch(/^[A-F0-9]{8}$/);
    const stored = readFileSync(path.join(reportDir, 'reports.jsonl'), 'utf8');
    expect(stored).toContain('The page now lists a different fee');
    expect(stored).toContain('"institutionName":"Example University One"');
  });

  it('silently discards honeypot submissions', async () => {
    const response = await request(app)
      .post('/api/reports')
      .send({
        issueType: 'other',
        field: 'other',
        details: 'This should never be stored by the server.',
        website: 'https://spam.example',
      })
      .expect(202);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects cross-site page URLs and non-http source URLs', async () => {
    const response = await request(app)
      .post('/api/reports')
      .send({
        issueType: 'incorrect',
        field: 'city',
        details: 'The listed city is wrong for this campus.',
        pageUrl: '//evil.example/path',
        sourceUrl: 'javascript:alert(1)',
      })
      .expect(400);
    expect(response.body.detail).toMatch(/site-relative|http/);
  });
});

describe('admin review', () => {
  it('is disabled when no admin token is configured', async () => {
    const response = await request(app).get('/api/admin/reports').expect(503);
    expect(response.body.error).toMatch(/not configured/);
  });

  it('requires a session when configured, and blocks cross-origin sign-in', async () => {
    const guarded = createApp({
      store: makeFixtureStore(),
      reportStoreDir: reportDir,
      adminToken: 'a'.repeat(32),
      distDir: path.join(reportDir, 'no-dist'),
    });
    await request(guarded).get('/api/admin/reports').expect(401);
    await request(guarded)
      .post('/api/admin/session')
      .set('Origin', 'https://evil.example')
      .send({ token: 'a'.repeat(32) })
      .expect(403);
  });
});

describe('missing dataset', () => {
  it('returns 503 with an actionable message rather than fake data', async () => {
    const empty = createApp({
      store: null,
      dataError: new Error('No dataset found in fixtures.'),
      reportStoreDir: reportDir,
      distDir: path.join(reportDir, 'no-dist'),
    });
    await request(empty).get('/api/health').expect(503);
    const search = await request(empty).get('/api/search?q=oxford').expect(503);
    expect(search.body.detail).toMatch(/No dataset found/);
  });
});
