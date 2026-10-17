import { useCallback, useEffect, useState } from 'react';
import type { CorrectionReport } from '../../server/reports';
import { ApiError } from '../lib/api';
import { usePageTitle, useRobotsNoIndex } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import { REPORT_FIELDS, REPORT_ISSUE_TYPES } from '../lib/labels';
import { Badge } from '../components/Badge';
import { EmptyBlock, ErrorBlock, LoadingBlock, Notice } from '../components/States';

type Status = CorrectionReport['status'];

const STATUSES: Array<{ id: Status; label: string; tone: 'positive' | 'neutral' | 'caution' | 'muted' }> = [
  { id: 'new', label: 'New', tone: 'caution' },
  { id: 'reviewing', label: 'Reviewing', tone: 'neutral' },
  { id: 'resolved', label: 'Resolved', tone: 'positive' },
  { id: 'rejected', label: 'Rejected', tone: 'muted' },
];

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    ...init,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError((body as { error?: string })?.error ?? `Request failed (${response.status}).`, {
      status: response.status,
      detail: (body as { detail?: string })?.detail,
    });
  }
  return body as T;
}

export function AdminPage() {
  usePageTitle('Report review');
  useRobotsNoIndex();
  const [state, setState] = useState<'checking' | 'signed-out' | 'configured-off' | 'ready' | 'error'>('checking');
  const [token, setToken] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<CorrectionReport[]>([]);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    const result = await jsonFetch<{ reports: CorrectionReport[] }>('/api/admin/reports');
    setReports(result.reports);
    setState('ready');
  }, []);

  useEffect(() => {
    let active = true;
    jsonFetch<{ configured: boolean; authenticated: boolean }>('/api/admin/session')
      .then(async (session) => {
        if (!active) return;
        if (!session.configured) {
          setState('configured-off');
          return;
        }
        if (!session.authenticated) {
          setState('signed-out');
          return;
        }
        await loadReports();
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'The review queue could not be loaded.');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [loadReports]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setError(null);
    try {
      await jsonFetch('/api/admin/session', { method: 'POST', body: JSON.stringify({ token }) });
      setToken('');
      await loadReports();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    await jsonFetch('/api/admin/session', { method: 'DELETE' }).catch(() => null);
    setReports([]);
    setState('signed-out');
  };

  const setStatus = async (report: CorrectionReport, status: Status) => {
    setUpdating(report.id);
    setError(null);
    try {
      const result = await jsonFetch<{ report: CorrectionReport }>(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setReports((current) => current.map((item) => (item.id === report.id ? result.report : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The status could not be changed.');
    } finally {
      setUpdating(null);
    }
  };

  const visible = filter === 'all' ? reports : reports.filter((report) => report.status === filter);
  const counts = reports.reduce<Record<string, number>>((accumulator, report) => {
    accumulator[report.status] = (accumulator[report.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Private review queue · not indexed</p>
        <h1>Correction reports</h1>
        <p className="page-sub">
          This queue is for the person who maintains this deployment. Changing a status here does not edit any
          institution data; data changes go through the reviewed research files.
        </p>
      </header>

      {state === 'checking' ? <LoadingBlock label="Checking session" /> : null}
      {state === 'error' ? <ErrorBlock error={error} title="The review queue is unavailable" /> : null}

      {state === 'configured-off' ? (
        <Notice tone="warning" title="Admin review is not configured">
          <p>
            This deployment has no <code>ADMIN_TOKEN</code> set, so the review queue is disabled and reports are only
            stored. Configure a token on the server to review them.
          </p>
        </Notice>
      ) : null}

      {state === 'signed-out' ? (
        <form className="admin-login" onSubmit={signIn}>
          <div className="field">
            <label htmlFor="admin-token">Admin token</label>
            <input
              id="admin-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="current-password"
              required
              minLength={24}
            />
            <p className="field-note">
              The token is checked on the server and exchanged for an HttpOnly session cookie. It is never stored in the
              browser’s local storage or in a build artifact. This page is not linked in navigation.
            </p>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit" className="button" disabled={signingIn || token.length < 24}>
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : null}

      {state === 'ready' ? (
        <>
          <div className="admin-toolbar">
            <div className="filter-chips" role="group" aria-label="Filter by status">
              <button
                type="button"
                className={filter === 'all' ? 'chip chip--active' : 'chip'}
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
              >
                All <span className="chip__count">{reports.length}</span>
              </button>
              {STATUSES.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  className={filter === status.id ? 'chip chip--active' : 'chip'}
                  onClick={() => setFilter(status.id)}
                  aria-pressed={filter === status.id}
                >
                  {status.label} <span className="chip__count">{counts[status.id] ?? 0}</span>
                </button>
              ))}
            </div>
            <button type="button" className="button button--ghost button--small" onClick={signOut}>
              Sign out
            </button>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          {visible.length === 0 ? (
            <EmptyBlock title={reports.length === 0 ? 'No reports yet' : 'No reports with this status'}>
              <p>{reports.length === 0 ? 'The queue is empty. Reports appear here after someone submits the public form.' : 'Choose another status filter.'}</p>
            </EmptyBlock>
          ) : (
            <ul className="report-list">
              {visible.map((report) => {
                const status = STATUSES.find((item) => item.id === report.status)!;
                return (
                  <li className="report-card" key={report.id}>
                    <div className="report-card__head">
                      <div>
                        <Badge tone={status.tone}>{status.label}</Badge>{' '}
                        <Badge tone="outline">
                          {REPORT_ISSUE_TYPES.find((item) => item.id === report.issueType)?.label ?? report.issueType}
                        </Badge>{' '}
                        <span className="cell-note">
                          {REPORT_FIELDS.find((item) => item.id === report.field)?.label ?? report.field}
                        </span>
                      </div>
                      <span className="cell-note">Received {formatDateTime(report.createdAt)}</span>
                    </div>
                    <p className="report-card__details">{report.details}</p>
                    <dl className="mini-dl">
                      <div>
                        <dt>Institution</dt>
                        <dd>
                          {report.institutionId ? (
                            <a href={`/university/${report.institutionId}`}>
                              {report.institutionName ?? report.institutionId}
                            </a>
                          ) : (
                            'Not linked'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Page reported</dt>
                        <dd>{report.pageUrl ?? 'Not recorded'}</dd>
                      </div>
                      <div>
                        <dt>Source offered</dt>
                        <dd>
                          {report.sourceUrl ? (
                            <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer">{report.sourceUrl}</a>
                          ) : (
                            'None'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Contact email</dt>
                        <dd>{report.email ?? 'None provided'}</dd>
                      </div>
                    </dl>
                    <div className="report-card__actions">
                      <span className="cell-note">Set status:</span>
                      {STATUSES.filter((item) => item.id !== report.status).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="button button--secondary button--small"
                          disabled={updating === report.id}
                          onClick={() => setStatus(report, item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Notice tone="info" title="Data corrections are separate">
            <p>
              A status change records triage, not truth. Updating a fee or deadline requires a reviewed research-file
              change with its official source and read date, then a new build.
            </p>
          </Notice>
        </>
      ) : null}
    </div>
  );
}
