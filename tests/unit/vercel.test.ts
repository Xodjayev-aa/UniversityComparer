import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { originalUrlFromRewrite } from '../../server/vercel';
import { SupabaseReportStore, supabaseReportsConfigured } from '../../server/supabase-reports';

describe('Vercel rewrite handling', () => {
  it('restores the original path and keeps the query string', () => {
    expect(originalUrlFromRewrite('/api/index?__path=/search&q=WIUT')).toBe('/search?q=WIUT');
    expect(originalUrlFromRewrite('/api/index?q=WIUT&__path=%2Fsearch')).toBe('/search?q=WIUT');
  });

  it('matches the rewrite used by vercel.json for nested API paths', () => {
    expect(originalUrlFromRewrite('/api/index?__path=/api/institutions/ror-abc')).toBe(
      '/api/institutions/ror-abc',
    );
    expect(originalUrlFromRewrite('/api/index?__path=/api/admin/reports&__path')).toBe('/api/admin/reports');
  });

  it('keeps the /api prefix that the rewrite destination carries', () => {
    expect(originalUrlFromRewrite('/api/index?__path=/api/health&deploy=cbd7570')).toBe(
      '/api/health?deploy=cbd7570',
    );
  });

  it('is a no-op when the runtime already passes the original URL', () => {
    expect(originalUrlFromRewrite('/api/health')).toBe('/api/health');
    expect(originalUrlFromRewrite('/api/search?q=WIUT')).toBe('/api/search?q=WIUT');
  });
});

describe('Supabase report storage', () => {
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    table: process.env.SUPABASE_REPORTS_TABLE,
  };

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://demo.supabase.co/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    delete process.env.SUPABASE_REPORTS_TABLE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [name, value] of [
      ['SUPABASE_URL', saved.url],
      ['SUPABASE_SERVICE_ROLE_KEY', saved.key],
      ['SUPABASE_REPORTS_TABLE', saved.table],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('is only enabled when both variables are present', () => {
    expect(supabaseReportsConfigured()).toBe(true);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(supabaseReportsConfigured()).toBe(false);
  });

  it('writes snake_case columns and maps the created row back', async () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-10-17T06:00:00.000Z',
      status: 'new',
      issue_type: 'outdated',
      field: 'tuition',
      details: 'The listed fee is out of date.',
      institution_id: 'ror-abc',
      institution_name: 'Example University',
      page_url: '/university/ror-abc',
      source_url: 'https://example.edu/fees',
      email: null,
    };
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([row]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const report = await new SupabaseReportStore().append({
      issueType: 'outdated',
      field: 'tuition',
      details: 'The listed fee is out of date.',
      institutionId: 'ror-abc',
      institutionName: 'Example University',
      pageUrl: '/university/ror-abc',
      sourceUrl: 'https://example.edu/fees',
      email: null,
    });

    expect(report.id).toBe(row.id);
    expect(report.createdAt).toBe(row.created_at);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://demo.supabase.co/rest/v1/reports');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).apikey).toBe('service-role-key');
    const body = JSON.parse(String(init?.body));
    expect(body.issue_type).toBe('outdated');
    expect(body.institution_name).toBe('Example University');
    expect(body.status).toBe('new');
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lists newest first and returns null when an update matches nothing', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const store = new SupabaseReportStore();
    await expect(store.list()).resolves.toEqual([]);
    await expect(store.update('missing', { status: 'resolved' })).resolves.toBeNull();
    expect(String(fetchMock.mock.calls[1]![0])).toContain('id=eq.missing');
  });

  it('explains missing configuration instead of throwing an opaque fetch error', async () => {
    delete process.env.SUPABASE_URL;
    await expect(
      new SupabaseReportStore().append({
        issueType: 'other',
        field: 'other',
        details: 'A sufficiently long report.',
        institutionId: null,
        institutionName: null,
        pageUrl: null,
        sourceUrl: null,
        email: null,
      }),
    ).rejects.toThrow(/Supabase is not configured/);
  });
});
