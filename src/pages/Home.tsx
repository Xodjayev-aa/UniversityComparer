import { Link } from 'react-router-dom';
import { useAsync, usePageTitle } from '../lib/hooks';
import { useMeta } from '../lib/meta';
import { api } from '../lib/api';
import { SearchBar } from '../components/SearchBar';
import { InstitutionCard } from '../components/InstitutionCard';
import { Badge, VerificationBadge } from '../components/Badge';
import { SkeletonList } from '../components/States';
import { formatDate, formatNumber } from '../lib/format';
import { REGION_LABELS, subjectLabel } from '../../shared/taxonomy';

const EXAMPLES = ['Toronto', '東京大学', 'Universitas Indonesia', 'Nairobi'];

export function HomePage() {
  usePageTitle(null);
  const { meta, loading: metaLoading, error: metaError } = useMeta();
  const featured = useAsync(() => api.search({ profile: 'source-checked', pageSize: 6, sort: 'name' }), []);
  const facets = useAsync(() => api.facets(), []);

  const totals = meta?.coverage.totals;
  const regionCounts = new Map<string, { countries: number; records: number }>();
  for (const country of meta?.coverage.countries ?? []) {
    const current = regionCounts.get(country.region) ?? { countries: 0, records: 0 };
    current.countries += country.universityRecords > 0 ? 1 : 0;
    current.records += country.universityRecords;
    regionCounts.set(country.region, current);
  }
  const regions = [...regionCounts.entries()]
    .filter(([region]) => region !== 'Other')
    .sort((a, b) => b[1].records - a[1].records);

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">University discovery, with receipts</p>
            <h1>Find a university that fits the facts.</h1>
            <p className="hero__lead">
              Search a directory of universities and education organisations in{' '}
              {totals ? formatNumber(totals.countries) : 'many'} countries and territories. Then see exactly which
              programmes, fees and deadlines we have read from official pages — and which are still unknown. Directory
              coverage is broad, not complete.
            </p>
            <SearchBar size="large" />
            <div className="search-examples">
              <span>Try</span>
              {EXAMPLES.map((example) => (
                <Link key={example} to={`/search?q=${encodeURIComponent(example)}`} className="text-link">
                  {example}
                </Link>
              ))}
            </div>
            <ul className="hero__points">
              <li>Free, no account</li>
              <li>No invented numbers</li>
              <li>Missing data stays missing</li>
            </ul>
          </div>

          <aside className="hero__panel" aria-labelledby="hero-panel-title">
            <h2 id="hero-panel-title" className="hero__panel-title">Read the label, not the logo</h2>
            <div className="legend-row">
              <VerificationBadge level="official-source-checked" />
              <p>Every shown fact links to an official page we read on a stated date.</p>
            </div>
            <div className="legend-row">
              <VerificationBadge level="directory-only" />
              <p>Discovery only. No programme, fee, deadline or recognition data is claimed.</p>
            </div>
            <div className="legend-row">
              <Badge tone="caution">Broader education record</Badge>
              <p>An ROR education organisation that is not classified as a university.</p>
            </div>
            <Link className="text-link" to="/coverage">
              See what is covered — and the gaps <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>

      <section className="stat-band" aria-label="Dataset coverage">
        <div className="container stat-band__grid">
          <div className="stat">
            <span className="stat__value">{totals ? formatNumber(totals.records) : metaLoading ? '…' : '—'}</span>
            <span className="stat__label">Directory records, not “every university”</span>
          </div>
          <div className="stat">
            <span className="stat__value">{totals ? formatNumber(totals.countries) : metaLoading ? '…' : '—'}</span>
            <span className="stat__label">Countries / territories in the directory</span>
          </div>
          <div className="stat">
            <span className="stat__value">{totals ? formatNumber(totals.sourceChecked) : metaLoading ? '…' : '—'}</span>
            <span className="stat__label">Source-checked profiles</span>
          </div>
          <div className="stat">
            <span className="stat__value stat__value--small">
              {meta ? formatDate(meta.coverage.directoryAsOf) : metaLoading ? '…' : '—'}
            </span>
            <span className="stat__label">Directory snapshot date (not “updated today”)</span>
          </div>
        </div>
        {metaError ? (
          <div className="container">
            <p className="inline-error">Coverage information could not be loaded. <Link to="/coverage">Open the coverage page</Link> for another attempt.</p>
          </div>
        ) : null}
      </section>

      <section className="section container" aria-labelledby="how-title">
        <div className="section-head">
          <p className="eyebrow">Built for honesty</p>
          <h2 id="how-title">Three rules shape every page</h2>
        </div>
        <div className="rule-grid">
          <article className="rule-card">
            <span className="rule-card__number">01</span>
            <h3>Discovery is not proof</h3>
            <p>
              A directory listing helps you find a university. It is not accreditation, and it is not evidence that a
              programme or fee is current.
            </p>
          </article>
          <article className="rule-card">
            <span className="rule-card__number">02</span>
            <h3>Facts carry their context</h3>
            <p>
              Fee facts show original currency, unit, academic year, applicant category and whether mandatory fees are
              included. A single universal “tuition” number would be misleading.
            </p>
          </article>
          <article className="rule-card">
            <span className="rule-card__number">03</span>
            <h3>Unknown is not zero</h3>
            <p>
              Missing fees are excluded from cost rankings, not treated as cheap. Missing programmes are not proof that
              a university does not offer them.
            </p>
          </article>
        </div>
      </section>

      <section className="section container" aria-labelledby="featured-title">
        <div className="section-head section-head--row">
          <div>
            <p className="eyebrow">Official pages, cited</p>
            <h2 id="featured-title">Source-checked profiles</h2>
            <p className="section-sub">
              A small sample, not a ranking. Each fact links to the page we read.
            </p>
          </div>
          <Link className="button button--secondary button--small" to="/search?profile=source-checked">
            Browse all source-checked
          </Link>
        </div>
        {featured.loading ? <SkeletonList count={3} /> : null}
        {featured.error ? (
          <p className="inline-error">Source-checked profiles could not be loaded. {featured.error.message}</p>
        ) : null}
        {featured.data && featured.data.total === 0 ? (
          <div className="empty-inline">
            <p>
              No source-checked profiles are present in this build yet. Directory discovery still works; programme,
              fee and deadline fields stay marked “Not available” until reviewed.
            </p>
            <Link className="text-link" to="/coverage">See the coverage report →</Link>
          </div>
        ) : null}
        {featured.data && featured.data.items.length > 0 ? (
          <div className="card-grid card-grid--3">
            {featured.data.items.map((institution) => (
              <InstitutionCard key={institution.id} summary={institution} headingLevel={3} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="section section--tint" aria-labelledby="browse-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Start broad</p>
            <h2 id="browse-title">Browse by region or subject</h2>
          </div>
          <div className="browse-columns">
            <div>
              <h3 className="browse-subtitle">Regions</h3>
              <div className="region-grid">
                {regions.map(([region, counts]) => (
                  <Link
                    key={region}
                    className="region-card"
                    to={`/search?region=${encodeURIComponent(region)}`}
                  >
                    <span className="region-card__name">{REGION_LABELS[region as keyof typeof REGION_LABELS] ?? region}</span>
                    <span className="region-card__meta">
                      {formatNumber(counts.records)} university-scope records in {counts.countries} countries
                    </span>
                  </Link>
                ))}
              </div>
              <Link className="text-link" to="/countries">See all countries <span aria-hidden="true">→</span></Link>
            </div>
            <div>
              <h3 className="browse-subtitle">Subjects with source-checked programmes</h3>
              {facets.loading ? <p className="footer-muted">Loading subjects…</p> : null}
              {facets.error ? <p className="inline-error">Subjects are unavailable right now.</p> : null}
              {facets.data && facets.data.subjects.length === 0 ? (
                <p className="data-empty">
                  No subject filter is available yet because no programmes have been source-checked. This section stays
                  empty rather than listing subjects we have not verified.
                </p>
              ) : null}
              {facets.data && facets.data.subjects.length > 0 ? (
                <div className="chip-cloud">
                  {facets.data.subjects.map((subject) => (
                    <Link key={subject.id} className="chip chip--link" to={`/search?subject=${subject.id}`}>
                      {subjectLabel(subject.id)}
                      <span className="chip__count">{subject.institutionCount}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <Link className="text-link" to="/subjects">All subjects <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="limits-title">
        <div className="limit-panel">
          <div>
            <p className="eyebrow">Deliberate limits</p>
            <h2 id="limits-title">What UniScope does not do</h2>
            <p>
              No university quality score. No admission chances. No “world’s best” ranking. No fabricated fees or
              deadline guesses. No claim that a directory is complete or that a missing field means “no”.
            </p>
            <p>
              Comparison priorities use only comparable, source-checked data and show the trade-offs. When the evidence
              is insufficient, the app says so.
            </p>
          </div>
          <div className="limit-actions">
            <Link className="button button--primary" to="/compare">Try a comparison</Link>
            <Link className="button button--secondary" to="/coverage">Read the coverage report</Link>
          </div>
        </div>
      </section>
    </>
  );
}
