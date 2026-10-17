import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Region } from '../../shared/types';
import { REGION_LABELS } from '../../shared/taxonomy';
import { api } from '../lib/api';
import { useAsync, usePageTitle } from '../lib/hooks';
import { formatNumber, plural } from '../lib/format';
import { BackLink, EmptyBlock, ErrorBlock, LoadingBlock, Notice } from '../components/States';
import { InstitutionCard } from '../components/InstitutionCard';

const REGION_ORDER: Region[] = ['Europe', 'Asia', 'Americas', 'Africa', 'Oceania', 'Other'];

export function CountriesPage() {
  const { code } = useParams();
  const facets = useAsync(() => api.facets(), []);
  const [filter, setFilter] = useState('');
  usePageTitle(code ? `Universities in ${(facets.data?.countries ?? []).find((c) => c.code === code)?.name ?? code}` : 'Browse by country');

  const grouped = useMemo(() => {
    const countries = (facets.data?.countries ?? []).filter((country) =>
      filter.trim() ? `${country.name} ${country.code}`.toLowerCase().includes(filter.trim().toLowerCase()) : true,
    );
    const byRegion = new Map<Region, typeof countries>();
    for (const country of countries) {
      const list = byRegion.get(country.region) ?? [];
      list.push(country);
      byRegion.set(country.region, list);
    }
    return REGION_ORDER.filter((region) => byRegion.has(region)).map((region) => ({
      region,
      countries: byRegion.get(region)!.sort((a, b) => b.universityRecords - a.universityRecords || a.name.localeCompare(b.name)),
    }));
  }, [facets.data, filter]);

  const totalRecords = (facets.data?.countries ?? []).reduce((sum, country) => sum + country.universityRecords, 0);

  if (code) return <CountryDetail code={code.toUpperCase()} />;

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Directory coverage, not a world census</p>
        <h1>Browse by country</h1>
        <p className="page-sub">
          Country counts come from the ROR and Hipo directory records in this release. A country with no record is a
          coverage gap, not evidence that it has no universities.
        </p>
      </header>

      {facets.loading ? <LoadingBlock label="Loading countries" /> : null}
      {facets.error ? <ErrorBlock error={facets.error} title="Countries could not be loaded" onRetry={facets.reload} /> : null}

      {facets.data ? (
        <>
          <div className="browse-summary">
            <span><strong>{formatNumber(facets.data.countries.length)}</strong> countries with at least one record</span>
            <span><strong>{formatNumber(totalRecords)}</strong> university-scope directory records</span>
            <span><strong>{formatNumber(facets.data.totals.sourceChecked)}</strong> source-checked profiles</span>
          </div>

          <div className="field browse-search">
            <label htmlFor="country-filter">Find a country</label>
            <input
              id="country-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Country name or ISO code"
              autoComplete="off"
            />
          </div>

          {grouped.length === 0 ? (
            <EmptyBlock title="No matching country">
              <p>That country may simply not be in this release’s directory records. Coverage is not complete.</p>
            </EmptyBlock>
          ) : (
            grouped.map(({ region, countries }) => (
              <section className="region-block" key={region} aria-labelledby={`region-${region.replace(/\s+/g, '-').toLowerCase()}`}>
                <h2 id={`region-${region.replace(/\s+/g, '-').toLowerCase()}`}>{REGION_LABELS[region]}</h2>
                <ul className="country-grid">
                  {countries.map((country) => (
                    <li key={country.code}>
                      <Link to={`/countries/${country.code}`} className="country-card">
                        <span className="country-card__name">{country.name}</span>
                        <span className="country-card__meta">
                          {formatNumber(country.universityRecords)} {plural(country.universityRecords, 'record')}
                        </span>
                        <span className="country-card__meta country-card__meta--checked">
                          {country.sourceChecked > 0
                            ? `${country.sourceChecked} source-checked`
                            : 'No source-checked profiles'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

function CountryDetail({ code }: { code: string }) {
  const facets = useAsync(() => api.facets(), []);
  const country = facets.data?.countries.find((item) => item.code === code);
  const search = useAsync(
    () => api.search({ country: code, scope: 'university', sort: 'name', pageSize: 50 }),
    [code],
  );
  usePageTitle(country ? `Universities in ${country.name}` : 'Country');

  return (
    <div className="container page">
      <BackLink to="/countries">All countries</BackLink>
      <header className="page-head">
        <p className="eyebrow">Directory records</p>
        <h1>{country?.name ?? code}</h1>
        {country ? (
          <p className="page-sub">
            {formatNumber(country.universityRecords)} university-scope {plural(country.universityRecords, 'record')} in
            this release. {country.sourceChecked > 0
              ? `${country.sourceChecked} ${plural(country.sourceChecked, 'profile')} have official-page facts.`
              : 'None have source-checked facts yet, so fees, deadlines and recognition are not shown.'}
          </p>
        ) : null}
      </header>

      {search.loading ? <LoadingBlock label="Loading institutions" /> : null}
      {search.error ? <ErrorBlock error={search.error} title="Institutions could not be loaded" onRetry={search.reload} /> : null}
      {search.data ? (
        <>
          {search.data.notices.map((notice) => <Notice key={notice}>{notice}</Notice>)}
          <p className="result-count">
            {formatNumber(search.data.total)} {plural(search.data.total, 'institution')} listed
            {search.data.total > search.data.items.length ? ` · showing the first ${search.data.items.length}` : ''}
          </p>
          <div className="institution-grid">
            {search.data.items.map((item) => (
              <InstitutionCard key={item.id} summary={item} />
            ))}
          </div>
          {search.data.total > search.data.items.length ? (
            <p className="footer-muted">
              <Link to={`/search?country=${code}&scope=university&sort=name`}>Open the full search for {country?.name ?? code} →</Link>
            </p>
          ) : null}
          <p className="cell-note">
            This list is the whole country record set returned by the directory build, not a claim that these are the
            only universities in {country?.name ?? code}.
          </p>
        </>
      ) : null}
    </div>
  );
}
