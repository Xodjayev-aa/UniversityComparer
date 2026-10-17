import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Institution } from '../../shared/types';
import { usePageTitle, useShortlist, useOnlineStatus } from '../lib/hooks';
import {
  buildComparisonMarkdown,
  buildShortlistCsv,
  buildShortlistMarkdown,
  downloadText,
  exportFilename,
} from '../lib/export';
import { compareInstitutions, DEFAULT_COMPARE_OPTIONS } from '../lib/compare';
import { relativeSaved } from '../lib/format';
import { EmptyBlock, Notice } from '../components/States';
import { VerificationBadge } from '../components/Badge';

export function ShortlistPage() {
  usePageTitle('Saved shortlist');
  const shortlist = useShortlist();
  const online = useOnlineStatus();
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [includeNotes, setIncludeNotes] = useState(false);

  const savedWithFull = useMemo(
    () => shortlist.items.filter((item): item is typeof item & { full: Institution } => Boolean(item.full)),
    [shortlist.items],
  );

  const comparison = useMemo(() => {
    if (savedWithFull.length < 2) return null;
    const records = savedWithFull.slice(0, 4).map((item) => item.full);
    return compareInstitutions(records, { ...DEFAULT_COMPARE_OPTIONS });
  }, [savedWithFull]);

  const exportCsv = () => {
    downloadText(
      exportFilename('uniscope-shortlist', 'csv'),
      buildShortlistCsv(shortlist.items, includeNotes),
      'text/csv',
    );
    setMessage(
      includeNotes
        ? 'CSV exported to this device, including your local private notes.'
        : 'CSV exported to this device. Private notes were left out.',
    );
  };

  const exportMarkdown = () => {
    downloadText(
      exportFilename('uniscope-shortlist', 'md'),
      buildShortlistMarkdown(shortlist.items),
      'text/markdown',
    );
    setMessage('Markdown exported. It contains public profile data and saved dates only.');
  };

  const exportComparison = () => {
    if (!comparison || savedWithFull.length === 0) return;
    downloadText(
      exportFilename('uniscope-saved-comparison', 'md'),
      buildComparisonMarkdown(
        savedWithFull.slice(0, 4).map((item) => item.full),
        comparison,
        DEFAULT_COMPARE_OPTIONS,
      ),
      'text/markdown',
    );
    setMessage('Saved-data comparison exported. No private notes included.');
  };

  const remove = (id: string, name: string) => {
    shortlist.remove(id);
    setMessage(`${name} removed from this device.`);
  };

  if (shortlist.items.length === 0) {
    return (
      <div className="container page">
        <header className="page-head">
          <p className="eyebrow">Stored on this device only</p>
          <h1>Your shortlist</h1>
        </header>
        <EmptyBlock title="Nothing saved yet">
          <p>
            Save universities while you search. Shortlists live in this browser’s local storage — no account, no
            server copy and no way for us to read them.
          </p>
          <Link className="button" to="/search">Search universities</Link>
        </EmptyBlock>
      </div>
    );
  }

  const oldest = shortlist.items.reduce((min, item) => (item.savedAt < min ? item.savedAt : min), shortlist.items[0]!.savedAt);

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Stored on this device only</p>
        <h1>Your shortlist</h1>
        <p className="page-sub">
          {shortlist.items.length} saved {shortlist.items.length === 1 ? 'institution' : 'institutions'}. Clearing
          browser data will delete this list. Saved snapshots keep their original read dates.
        </p>
      </header>

      <div className="shortlist-toolbar">
        <label className="check">
          <input type="checkbox" checked={includeNotes} onChange={(event) => setIncludeNotes(event.target.checked)} />
          <span>
            Include my private notes in the CSV export
            <small>Notes never leave this device unless you export them yourself.</small>
          </span>
        </label>
        <div className="compare-actions">
          <button type="button" className="button button--secondary button--small" onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" className="button button--secondary button--small" onClick={exportMarkdown}>
            Export Markdown
          </button>
          {comparison ? (
            <button type="button" className="button button--secondary button--small" onClick={exportComparison}>
              Export saved comparison
            </button>
          ) : null}
        </div>
      </div>
      <p role="status" aria-live="polite" className={message ? 'inline-status' : 'visually-hidden'}>
        {message}
      </p>

      {!online ? (
        <Notice tone="warning" title="Offline — saved information only">
          <p>
            This page shows what was saved on this device. It is not live and does not include anything researched after
            each saved date. The age of each snapshot is shown next to it.
          </p>
        </Notice>
      ) : null}

      {shortlist.items.some((item) => !item.full) ? (
        <Notice tone="info" title="Some saves have no full snapshot">
          <p>
            Older or partial saves contain only the search-result summary. Open those profiles while online to store a
            full public snapshot; saved summaries are never treated as researched profiles.
          </p>
        </Notice>
      ) : null}

      <ul className="shortlist-list">
        {shortlist.items.map((item) => (
          <li className="shortlist-item" key={item.id}>
            <div className="shortlist-item__head">
              <div>
                <h2>
                  <Link to={`/university/${item.id}`}>{item.summary.name}</Link>
                </h2>
                <p className="cell-note">
                  {item.summary.city ? `${item.summary.city}, ` : ''}
                  {item.summary.country.name} · saved {relativeSaved(item.savedAt)}
                </p>
                <div className="badge-row">
                  <VerificationBadge
                    level={item.summary.verificationLevel === 'source-checked' ? 'official-source-checked' : 'directory-only'}
                  />
                  <span className="cell-note">
                    {item.full ? 'Full public snapshot stored' : 'Summary only'}
                  </span>
                </div>
              </div>
              <div className="shortlist-item__actions">
                <Link className="button button--secondary button--small" to={`/university/${item.id}`}>
                  Open
                </Link>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setNotesOpenFor(notesOpenFor === item.id ? null : item.id)}
                  aria-expanded={notesOpenFor === item.id}
                  aria-controls={`notes-${item.id}`}
                >
                  {item.notes ? 'Edit note' : 'Add note'}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => remove(item.id, item.summary.name)}
                  aria-label={`Remove ${item.summary.name} from shortlist`}
                >
                  Remove
                </button>
              </div>
            </div>

            {notesOpenFor === item.id ? (
              <div className="shortlist-note" id={`notes-${item.id}`}>
                <label htmlFor={`note-input-${item.id}`}>Private note (stays in this browser)</label>
                <textarea
                  id={`note-input-${item.id}`}
                  rows={3}
                  defaultValue={item.notes ?? ''}
                  maxLength={2000}
                  onBlur={(event) => shortlist.setNotes(item.id, event.target.value)}
                  placeholder="e.g. ask about scholarship deadlines — never included in share links"
                />
                <p className="cell-note">
                  Notes are excluded from comparison, share links and exports unless you tick the CSV option above.
                </p>
              </div>
            ) : item.notes ? (
              <p className="shortlist-note-preview">
                <span className="visually-hidden">Private note: </span>“{item.notes}”
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="shortlist-compare" aria-labelledby="shortlist-compare-title">
        <h2 id="shortlist-compare-title">Compare saved profiles</h2>
        {comparison ? (
          <>
            <p>{comparison.outcome.title}. {comparison.outcome.detail}</p>
            <p className="cell-note">
              This uses saved snapshots (not fresh data). Newest save: {relativeSaved(
                shortlist.items.reduce((max, item) => (item.savedAt > max ? item.savedAt : max), shortlist.items[0]!.savedAt),
              )}. Oldest save: {relativeSaved(oldest)}.
            </p>
            <Link className="button button--secondary button--small" to={`/compare?ids=${savedWithFull.slice(0, 4).map((item) => item.id).join(',')}`}>
              Open full comparison
            </Link>
          </>
        ) : (
          <p>Save at least two profiles with full public snapshots to see a saved-data comparison. A live comparison is always more current.</p>
        )}
      </section>
    </div>
  );
}
