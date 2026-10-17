import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAsync, usePageTitle } from '../lib/hooks';
import { REPORT_FIELDS, REPORT_ISSUE_TYPES } from '../lib/labels';
import { Badge } from '../components/Badge';
import { Notice } from '../components/States';

const DETAIL_MIN = 10;
const DETAIL_MAX = 2000;

export function ReportPage() {
  usePageTitle('Report an issue');
  const [params] = useSearchParams();
  const institutionId = params.get('institution');
  const initialField = params.get('field');
  const institution = useAsync(
    () => (institutionId ? api.institution(institutionId) : Promise.resolve(null)),
    [institutionId],
  );

  const [issueType, setIssueType] = useState('incorrect');
  const [field, setField] = useState(initialField && REPORT_FIELDS.some((item) => item.id === initialField) ? initialField : 'other');
  const [details, setDetails] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    if (initialField && REPORT_FIELDS.some((item) => item.id === initialField)) setField(initialField);
  }, [initialField]);

  const profileName = institution.data?.institution.names.primary ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (details.trim().length < DETAIL_MIN) {
      setError(`Please describe the issue in at least ${DETAIL_MIN} characters.`);
      return;
    }
    let parsedSource: string | null = null;
    if (sourceUrl.trim()) {
      try {
        const url = new URL(sourceUrl.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
        parsedSource = url.toString();
      } catch {
        setError('The source link must be a full http(s) URL, or left blank.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const result = await api.report({
        issueType,
        field,
        details: details.trim(),
        institutionId,
        pageUrl: window.location.pathname + window.location.search,
        sourceUrl: parsedSource,
        email: email.trim() || null,
        website: honeypot,
      });
      if (result.reference) setReference(result.reference);
      else setReference('submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.detail
            ? `${caught.message} ${caught.detail}`
            : caught.message
          : 'The report could not be sent. Please try again later.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div className="container page page--narrow">
        <header className="page-head">
          <p className="eyebrow">Received</p>
          <h1>Thank you — the report is queued for review</h1>
        </header>
        <Notice tone="info" title="What happens next">
          <p>
            Reports are reviewed by a person before any data changes. A report is not itself evidence; we will check
            the source you gave and update the profile only if the official page supports it. We do not promise a
            review deadline.
          </p>
          {reference !== 'submitted' ? (
            <p>
              Reference: <code>{reference}</code>
            </p>
          ) : null}
        </Notice>
        <p>
          <Link className="button" to="/search">Back to search</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container page page--narrow">
      <header className="page-head">
        <p className="eyebrow">Corrections are part of the product</p>
        <h1>Report incorrect or outdated information</h1>
        <p className="page-sub">
          Tell us what is wrong and, if possible, link the official page that shows the correct information. No account
          is needed. We do not guarantee that every report leads to a change.
        </p>
      </header>

      {institutionId ? (
        <Notice>
          <p>
            Report about: <strong>{profileName ?? institutionId}</strong>
            {institution.error ? <span className="cell-note"> (the profile could not be loaded, but the ID will be recorded)</span> : null}
            {' · '}
            <Link to={`/university/${institutionId}`}>Open profile</Link>
          </p>
        </Notice>
      ) : null}

      <form className="report-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="report-issue">What kind of issue is it?</label>
          <select id="report-issue" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
            {REPORT_ISSUE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="report-field">Which part of the page?</label>
          <select id="report-field" value={field} onChange={(event) => setField(event.target.value)}>
            {REPORT_FIELDS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="report-details">
            What is wrong? <span className="field-required">(required)</span>
          </label>
          <textarea
            id="report-details"
            rows={6}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            minLength={DETAIL_MIN}
            maxLength={DETAIL_MAX}
            required
            aria-describedby="report-details-note"
            placeholder="e.g. The published tuition for 2026/27 is 12,000 EUR per year for international students, not 10,000 EUR."
          />
          <p id="report-details-note" className="field-note">
            {details.length}/{DETAIL_MAX} characters. Do not include personal data about other people.
          </p>
        </div>

        <div className="field">
          <label htmlFor="report-source">Official source link (optional)</label>
          <input
            id="report-source"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://www.example.edu/admissions/fees"
          />
          <p className="field-note">A university, ministry or accreditation-body page. A marketing blog is not proof.</p>
        </div>

        <div className="field">
          <label htmlFor="report-email">Contact email (optional)</label>
          <input
            id="report-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <p className="field-note">
            Only if you want a follow-up. It is kept with the report and is not published or used for marketing.
          </p>
        </div>

        <div className="honeypot" aria-hidden="true">
          <label htmlFor="report-website">Website</label>
          <input
            id="report-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="form-actions">
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send report'}
          </button>
          <Badge tone="muted">No account needed</Badge>
        </div>

        <p className="field-note">
          By sending a report you agree to our <Link to="/privacy">privacy notice</Link>. Reports are rate-limited and
          may be rejected if they contain spam or personal data.
        </p>
      </form>
    </div>
  );
}
