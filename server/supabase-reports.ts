import { randomUUID } from 'node:crypto';
import type { CorrectionReport, NewReport, ReportRepository, ReportStatus } from './reports';

/**
 * PostgREST row shape for the `reports` table created by
 * supabase/schema.sql. Keeping the mapping in one place makes the column
 * names explicit and keeps the rest of the API on the shared camelCase type.
 */
interface ReportRow {
  id: string;
  created_at: string;
  status: ReportStatus;
  issue_type: CorrectionReport['issueType'];
  field: string;
  details: string;
  institution_id: string | null;
  institution_name: string | null;
  page_url: string | null;
  source_url: string | null;
  email: string | null;
}

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function supabaseReportsConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function config(): { url: string; key: string; table: string } {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required).',
    );
  }
  const table = process.env.SUPABASE_REPORTS_TABLE?.trim() || 'reports';
  if (!TABLE_NAME.test(table)) {
    throw new Error('SUPABASE_REPORTS_TABLE must be a simple Postgres table name.');
  }
  return { url, key, table };
}

function fromRow(row: ReportRow): CorrectionReport {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    issueType: row.issue_type,
    field: row.field,
    details: row.details,
    institutionId: row.institution_id ?? null,
    institutionName: row.institution_name ?? null,
    pageUrl: row.page_url ?? null,
    sourceUrl: row.source_url ?? null,
    email: row.email ?? null,
  };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key, table } = config();
  const response = await fetch(`${url}/rest/v1/${table}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (!response.ok) {
    // Keep the upstream message in logs; the API layer turns it into a generic
    // 500 so database details never reach the browser.
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 400) || response.statusText}`);
  }
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Supabase returned a non-JSON response.');
  }
}

/**
 * Durable correction-report queue backed by Supabase PostgREST. The service
 * role key is only used server-side; RLS stays enabled and denies anon access.
 */
export class SupabaseReportStore implements ReportRepository {
  readonly kind = 'supabase';

  async append(input: NewReport): Promise<CorrectionReport> {
    const payload = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      status: 'new' satisfies ReportStatus,
      issue_type: input.issueType,
      field: input.field,
      details: input.details,
      institution_id: input.institutionId,
      institution_name: input.institutionName,
      page_url: input.pageUrl,
      source_url: input.sourceUrl,
      email: input.email,
    };
    const rows = await rest<ReportRow[]>('', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Prefer: 'return=representation' },
    });
    const row = rows?.[0];
    if (!row) throw new Error('Supabase insert returned no report row.');
    return fromRow(row);
  }

  async list(): Promise<CorrectionReport[]> {
    const rows = await rest<ReportRow[]>(
      '?select=id,created_at,status,issue_type,field,details,institution_id,institution_name,page_url,source_url,email&order=created_at.desc&limit=1000',
    );
    return (rows ?? []).map(fromRow);
  }

  async update(
    id: string,
    patch: { status?: ReportStatus },
  ): Promise<CorrectionReport | null> {
    if (!patch.status) return null;
    const rows = await rest<ReportRow[]>(`?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH',
      body: JSON.stringify({ status: patch.status }),
      headers: { Prefer: 'return=representation' },
    });
    const row = rows?.[0];
    return row ? fromRow(row) : null;
  }
}
