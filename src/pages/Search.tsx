import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { DegreeLevel } from '../../shared/types';
import { DEGREE_LEVELS, LANGUAGE_LABELS, REGION_LABELS, SUBJECT_IDS, subjectLabel } from '../../shared/taxonomy';
import { api, type SearchParams } from '../lib/api';
import { useAsync, useDebouncedValue, usePageTitle } from '../lib/hooks';
import { formatNumber } from '../lib/format';
import { SearchBar } from '../components/SearchBar';
import { InstitutionCard } from '../components/InstitutionCard';
import { EmptyBlock, ErrorBlock, Notice, SkeletonList } from '../components/States';
import { FilterSheet, EMPTY_FILTERS, filterCount, type FilterValues } from '../components/FilterSheet';

const VALID_DEGREES = new Set<string>(DEGREE_LEVELS.map((level) => level.id));
const VALID_REGIONS = new Set<string>(Object.keys(REGION_LABELS));
const VALID_SUBJECTS = new Set<string>(SUBJECT_IDS);

function readFilters(params: URLSearchParams): FilterValues {
  const degree = params.get('degree') ?? '';
  const region = params.get('region') ?? '';
  const subject = params.get('subject') ?? '';
  const country = (params.get('country') ?? '').toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    region: VALID_REGIONS.has(region) ? region : '',
    degree: VALID_DEGREES.has(degree) ? degree : '',
    language: (params.get('language') ?? '').slice(0, 20),
    mode: params.get('mode') === 'part-time' ? 'part-time' : params.get('mode') === 'full-time' ? 'full-time' : '',
    subject: VALID_SUBJECTS.has(subject) ? subject : '',
    fees: params.get('fees') === 'source-checked',
    profile: params.get('profile') === 'source-checked',
  };
}

function createSearchParams(filters: FilterValues): SearchParams {
  return {
    country: filters.country,
    region: filters.region,
    degree: filters.degree,
    language: filters.language,
    mode: filters.mode,
    subject: filters.subject,
    fees: filters.fees ? 'source-checked' : '',
    profile: filters.profile ? 'source-checked' : '',
  };
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  usePageTitle('Find universities');
  const query = (searchParams.get('q') ?? '').slice(0, 120);
  const scopeRaw = searchParams.get('scope');
  const scope: 'university' | 'all' = scopeRaw === 'all' ? 'all' : 'university';
  const page = Math.max(1, Math.min(100_000, Number(searchParams.get('page') ?? '1') || 1));
  const sort = searchParams.get('sort') === 'name' ? 'name' : 'relevance';
  const filters = readFilters(searchParams);
  const activeFilterCount = filterCount(filters);
  const [input, setInput] = useState(query);
  const [filterOpen, setFilterOpen] = useState(false);
  const pageKey = searchParams.toString();
  const resultsRef = useRef<HTMLDivElement>(null);
  const facets = useAsync(() => api.facets(), []);

  useEffect(() => {
    setInput(query);
  }, [query]);

  const apiParams: SearchParams = {
    q: query,
    scope,
    page,
    pageSize: 20,
    sort,
    ...createSearchParams(filters),
  };
  const result = useAsync(() => api.search(apiParams), [pageKey]);
  const debounced = useDebouncedValue(input, 380);

  useEffect(() => {
    const next = debounced.trim();
    if (next === query) return;
    const params = new URLSearchParams(searchParams);
    if (next) params.set('q', next);
    else params.delete('q');
    params.delete('page');
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const update = (patch: Record<string, string | null>, replace = false) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    if (!('page' in patch)) params.delete('page');
    setSearchParams(params, { replace });
  };

  const applyFilters = (values: FilterValues) => {
    const params = new URLSearchParams(searchParams);
    for (const key of ['country', 'region', 'degree', 'language', 'mode', 'subject', 'fees', 'profile']) {
      params.delete(key);
    }
    if (values.country) params.set('country', values.country);
    if (values.region) params.set('region', values.region);
    if (values.degree) params.set('degree', values.degree);
    if (values.language) params.set('language', values.language);
    if (values.mode) params.set('mode', values.mode);
    if (values.subject) params.set('subject', values.subject);
    if (values.fees) params.set('fees', 'source-checked');
    if (values.profile) params.set('profile', 'source-checked');
    params.delete('page');
    setSearchParams(params);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    for (const key of ['country', 'region', 'degree', 'language', 'mode', 'subject', 'fees', 'profile']) {
      params.delete(key);
    }
    params.delete('page');
    setSearchParams(params);
  };

  const goToPage = (nextPage: number) => {
    update({ page: String(nextPage) });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const data = result.data;
  const countryName = filters.country
    ? facets.data?.countries.find((country) => country.code === filters.country)?.name ?? filters.country
    : '';
  const activeChips: Array<{ key: keyof FilterValues; label: string }> = [];
  if (filters.country) activeChips.push({ key: 'country', label: countryName });
  if (filters.region) activeChips.push({ key: 'region', label: REGION_LABELS[filters.region as keyof typeof REGION_LABELS] ?? filters.region });
  if (filters.degree) activeChips.push({ key: 'degree', label: DEGREE_LEVELS.find((level) => level.id === filters.degree)?.label ?? filters.degree });
  if (filters.language) activeChips.push({ key: 'language', label: LANGUAGE_LABELS[filters.language] ?? filters.language });
  if (filters.mode) activeChips.push({ key: 'mode', label: filters.mode === 'full-time' ? 'Full-time' : 'Part-time' });
  if (filters.subject) activeChips.push({ key: 'subject', label: subjectLabel(filters.subject) });
  if (filters.fees) activeChips.push({ key: 'fees', label: 'Has fee data' });
  if (filters.profile) activeChips.push({ key: 'profile', label: 'Source-checked only' });

  const removeChip = (key: keyof FilterValues) => {
    const params = new URLSearchParams(searchParams);
    if (key === 'fees' || key === 'profile') params.delete(key);
    else params.delete(key);
    params.delete('page');
    setSearchParams(params);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    update({ q: input.trim() });
  };

  const start = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const end = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Directory search</p>
        <h1>Find a university</h1>
        <p className="page-sub">
          Search by name, alternate name, local-script name, city or country. Directory records are discovery aids;
          only source-checked profiles carry programme, fee and deadline facts.
        </p>
      </header>

      <div className="search-toolbar">
        <form className="search-bar search-bar--compact" role="search" onSubmit={onSubmit}>
          <label className="visually-hidden" htmlFor="search-query">
            Search universities
          </label>
          <span className="search-bar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id="search-query"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="University, city or country"
            autoComplete="off"
            maxLength={120}
            enterKeyHint="search"
          />
          <button type="submit" className="button button--primary">
            Search
          </button>
        </form>

        <div className="scope-toggle" role="group" aria-label="Directory scope">
          <button
            type="button"
            className={scope === 'university' ? 'scope-toggle__button scope-toggle__button--active' : 'scope-toggle__button'}
            aria-pressed={scope === 'university'}
            onClick={() => update({ scope: null })}
          >
            Universities
            {data ? <span className="scope-toggle__count">{formatNumber(data.scopeCounts.university)}</span> : null}
          </button>
          <button
            type="button"
            className={scope === 'all' ? 'scope-toggle__button scope-toggle__button--active' : 'scope-toggle__button'}
            aria-pressed={scope === 'all'}
            onClick={() => update({ scope: 'all' })}
          >
            All education records
            {data ? (
              <span className="scope-toggle__count">{formatNumber(data.scopeCounts.university + data.scopeCounts.education)}</span>
            ) : null}
          </button>
        </div>
      </div>

      {scope === 'all' ? (
        <Notice tone="info">
          “All education records” includes ROR organisations whose names did not pass the university-name heuristic.
          They are marked <strong>Broader education record</strong> and are not claimed as universities.
        </Notice>
      ) : null}

      <div className="result-toolbar">
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={() => setFilterOpen(true)}
          aria-haspopup="dialog"
        >
          Filters
          {activeFilterCount > 0 ? <span className="button__count">{activeFilterCount}</span> : null}
        </button>
        <div className="result-toolbar__right">
          <label className="inline-select">
            <span>Sort</span>
            <select value={sort} onChange={(event) => update({ sort: event.target.value === 'name' ? 'name' : null })}>
              <option value="relevance">Relevance</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="active-filters" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="chip chip--removable"
              onClick={() => removeChip(chip.key)}
              aria-label={`Remove filter: ${chip.label}`}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="text-link text-link--small" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : null}

      <div ref={resultsRef} className="results" aria-busy={result.loading}>
        <p className="result-count" role="status" aria-live="polite">
          {result.loading && !data
            ? 'Searching…'
            : data
              ? data.total === 0
                ? 'No matching records'
                : `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(data.total)} ${data.total === 1 ? 'record' : 'records'}`
              : 'Search unavailable'}
          {query ? <span className="result-count__query"> for “{query}”</span> : null}
        </p>

        {result.loading && !data ? <SkeletonList count={5} /> : null}
        {result.error ? (
          <ErrorBlock
            error={result.error}
            title="Search could not be completed"
            onRetry={result.reload}
          />
        ) : null}

        {data?.notices.map((notice) => (
          <Notice key={notice} tone="warning">
            {notice}
          </Notice>
        ))}

        {data && data.items.length > 0 ? (
          <div className="result-list">
            {data.items.map((institution) => (
              <InstitutionCard key={institution.id} summary={institution} headingLevel={2} />
            ))}
          </div>
        ) : null}

        {data && data.total === 0 && !result.error ? (
          <EmptyBlock
            title="No records match this search"
            action={
              <div className="button-row">
                {activeFilterCount > 0 ? (
                  <button type="button" className="button button--secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
                {scope === 'university' && data.scopeCounts.education > 0 ? (
                  <button type="button" className="button button--primary" onClick={() => update({ scope: 'all' })}>
                    Include broader education records
                  </button>
                ) : null}
              </div>
            }
          >
            <p>
              Try a shorter name, a local-script name, a city or a country. Directory coverage is not complete, so a
              missing result does not mean the institution does not exist.
            </p>
            <p className="footer-muted">
              Search scope: {scope === 'university' ? 'university-scope records' : 'all education records'}.
            </p>
          </EmptyBlock>
        ) : null}

        {data && data.pageCount > 1 ? (
          <nav className="pagination" aria-label="Search results pages">
            <button
              type="button"
              className="button button--secondary button--small"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
            >
              <span aria-hidden="true">←</span> Previous
            </button>
            <span className="pagination__status">
              Page {formatNumber(data.page)} of {formatNumber(data.pageCount)}
            </span>
            <button
              type="button"
              className="button button--secondary button--small"
              disabled={data.page >= data.pageCount}
              onClick={() => goToPage(data.page + 1)}
            >
              Next <span aria-hidden="true">→</span>
            </button>
          </nav>
        ) : null}
      </div>

      <details className="search-help">
        <summary>How search works</summary>
        <p>
          Search is Unicode-aware: accents are folded for Latin names, and local-script names are searchable. It matches
          names, aliases, acronyms, cities, countries and website domains. Results are ordered by match quality, not
          university quality.
        </p>
        <p>
          Programme filters use only source-checked programme data. Directory-only records are excluded by those filters
          and counted as unknown, never as “does not offer”.
        </p>
      </details>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={applyFilters}
        facets={facets.data}
        loading={facets.loading}
        error={facets.error}
      />
    </div>
  );
}
