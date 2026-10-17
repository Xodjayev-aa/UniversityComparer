import type {
  CoverageStats,
  Facets,
  Institution,
  InstitutionSummary,
  SearchResponse,
  SourceInfo,
} from '../../shared/types';

export interface MetaResponse {
  app: string;
  version: string;
  generatedAt: string;
  coverage: CoverageStats;
  sources: SourceInfo[];
}

export interface SearchParams {
  q?: string;
  scope?: 'university' | 'education' | 'all';
  country?: string;
  region?: string;
  degree?: string;
  language?: string;
  mode?: string;
  subject?: string;
  fees?: string;
  profile?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly isNetworkError: boolean;

  constructor(message: string, options: { status?: number; detail?: string; network?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.detail = options.detail;
    this.isNetworkError = options.network ?? false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    let body: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const payload = body as { error?: string; detail?: string } | null;
      throw new ApiError(payload?.error ?? `Request failed (${response.status}).`, {
        status: response.status,
        detail: payload?.detail,
      });
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request took too long. Check your connection and try again.', {
        network: true,
      });
    }
    throw new ApiError(
      'Could not reach UniScope. If you are offline, only saved snapshots are available.',
      { network: true },
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function searchPath(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    query.set(key, String(value));
  }
  return `/api/search?${query.toString()}`;
}

export const api = {
  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
    // request() owns its timeout controller; callers can still cancel by racing below.
    const promise = request<SearchResponse>(searchPath(params));
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      const abort = () => reject(new ApiError('Search cancelled.', { network: true }));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  },
  institution(id: string): Promise<{ institution: Institution; summary: InstitutionSummary }> {
    return request(`/api/institutions/${encodeURIComponent(id)}`);
  },
  compare(ids: string[]): Promise<{ items: Array<{ institution: Institution; summary: InstitutionSummary }> }> {
    return request(`/api/compare?ids=${encodeURIComponent(ids.join(','))}`);
  },
  facets(): Promise<Facets> {
    return request('/api/facets');
  },
  coverage(): Promise<CoverageStats> {
    return request('/api/coverage');
  },
  meta(): Promise<MetaResponse> {
    return request('/api/meta');
  },
  sources(): Promise<{ sources: SourceInfo[] }> {
    return request('/api/sources');
  },
  report(input: {
    issueType: string;
    field: string;
    details: string;
    institutionId?: string | null;
    pageUrl?: string | null;
    sourceUrl?: string | null;
    email?: string | null;
    website?: string;
  }): Promise<{ ok: boolean; reference?: string }> {
    return request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  adminSessionStatus(): Promise<{ configured: boolean; authenticated: boolean }> {
    return request('/api/admin/session');
  },
  adminLogin(token: string): Promise<{ ok: boolean }> {
    return request('/api/admin/session', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  adminLogout(): Promise<{ ok: boolean }> {
    return request('/api/admin/session', { method: 'DELETE' });
  },
  adminReports(): Promise<{ reports: AdminReport[] }> {
    return request('/api/admin/reports');
  },
  adminUpdateReport(id: string, status: string): Promise<{ report: AdminReport }> {
    return request(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

export interface AdminReport {
  id: string;
  createdAt: string;
  status: 'new' | 'reviewing' | 'resolved' | 'rejected';
  issueType: string;
  field: string;
  details: string;
  institutionId: string | null;
  institutionName: string | null;
  pageUrl: string | null;
  sourceUrl: string | null;
  email: string | null;
}
