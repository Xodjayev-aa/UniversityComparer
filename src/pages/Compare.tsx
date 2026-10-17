import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ApplicantCategory, DegreeLevel, Institution } from '../../shared/types';
import {
  APPLICANT_LABELS,
  DEGREE_LEVELS,
  SUBJECT_IDS,
  subjectLabel,
} from '../../shared/taxonomy';
import { api, ApiError } from '../lib/api';
import { useAsync, useDebouncedValue, usePageTitle, useShortlist } from '../lib/hooks';
import { useOnlineStatus } from '../lib/hooks';
import {
  compareInstitutions,
  DEFAULT_COMPARE_OPTIONS,
  feeContextLine,
  type CompareOptions,
  type ComparePriority,
} from '../lib/compare';
import { buildComparisonMarkdown, downloadText, exportFilename } from '../lib/export';
import { formatDate, formatFeeAmount, formatNumber, relativeSaved } from '../lib/format';
import { COMPARE_PRIORITIES, kindLabel } from '../lib/labels';
import { Badge, VerificationBadge } from '../components/Badge';
import { EmptyBlock, ErrorBlock, LoadingBlock, Notice } from '../components/States';
import { SearchBar } from '../components/SearchBar';
import type { InstitutionSummary } from '../../shared/types';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{3,90}$/;
const PRIORITIES = new Set<string>(['balanced', 'cost', 'subject', 'location']);
const CATEGORIES = new Set<string>([
  'international',
  'domestic',
  'home',
  'eu-eea',
  'in-state',
  'out-of-state',
  'other',
]);

function readIds(params: URLSearchParams): string[] {
  const raw = params.get('ids') ?? '';
  return [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => ID_PATTERN.test(id)))].slice(0, 4);
}

function readOptions(params: URLSearchParams): CompareOptions {
  const priority = params.get('p') ?? 'balanced';
  const subject = params.get('subject') ?? '';
  const degree = params.get('degree') ?? '';
  const category = params.get('cat') ?? 'international';
  return {
    priority: (PRIORITIES.has(priority) ? priority : 'balanced') as ComparePriority,
    subject: (SUBJECT_IDS as string[]).includes(subject) ? subject : '',
    degree: (DEGREE_LEVELS.some((level) => level.id === degree) ? degree : '') as DegreeLevel | '',
    applicantCategory: (CATEGORIES.has(category) ? category : 'international') as ApplicantCategory,
    countryPreference: (params.get('prefCountry') ?? '').toUpperCase().slice(0, 2),
    languagePreference: (params.get('prefLanguage') ?? '').slice(0, 20),
    requireProgram: params.get('reqProgram') === '1',
    requireCountry: params.get('reqCountry') === '1',
    requireSourceChecked: params.get('reqChecked') === '1',
    requireFeeData: params.get('reqFee') === '1',
  };
}

function AddInstitution({
  selected,
  onAdd,
  max,
}: {
  selected: string[];
  onAdd: (id: string) => void;
  max: number;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 320);
  const results = useAsync(
    () =>
      debounced.trim().length >= 2
        ? api.search({ q: debounced, pageSize: 6, scope: 'university' })
        : Promise.resolve(null),
    [debounced],
  );
  const atMax = selected.length >= max;
  return (
    <div className="add-institution">
      <label htmlFor="add-institution-input" className="field-label">
        Add an institution to the comparison
      </label>
      <div className="add-institution__row">
        <input
          id="add-institution-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, city or country"
          disabled={atMax}
          autoComplete="off"
        />
        {atMax ? <Badge tone="muted">Maximum {max} selected</Badge> : null}
      </div>
      {!atMax && debounced.trim().length >= 2 && results.loading ? <p className="cell-note">Searching…</p> : null}
      {!atMax && results.data && results.data.items.length === 0 ? (
        <p className="cell-note">No directory record matched. Coverage is not complete; try a shorter name.</p>
      ) : null}
      {!atMax && results.data && results.data.items.length > 0 ? (
        <ul className="add-results">
          {results.data.items.map((item) => {
            const already = selected.includes(item.id);
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span className="cell-note"> {item.city ? `${item.city}, ` : ''}{item.country.name}</span>
                </div>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  disabled={already}
                  onClick={() => onAdd(item.id)}
                >
                  {already ? 'Selected' : 'Add'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function deadlineSummary(record: Institution, evaluationProgramIds: string[], category: ApplicantCategory): string {
  const andPrograms = record.admissions.deadlines.filter((deadline) => deadline.applicantCategory === category);
  const programDeadlines = record.programs
    .filter((program) => evaluationProgramIds.includes(program.id))
    .flatMap((program) => program.deadlines)
    .filter((deadline) => deadline.applicantCategory === category);
  const all = [...andPrograms, ...programDeadlines].sort((a, b) => {
    const left = a.date ? Date.parse(`${a.date}T00:00:00Z`) : Number.POSITIVE_INFINITY;
    const right = b.date ? Date.parse(`${b.date}T00:00:00Z`) : Number.POSITIVE_INFINITY;
    return left - right;
  });
  if (all.length === 0) return 'No source-checked deadline for this applicant category';
  const first = all[0]!;
  return `${all.length} listed (${first.dateText}; ${first.intake}) — dates are not promises`;
}

export function ComparePage() {
  usePageTitle('Compare universities');
  const [searchParams, setSearchParams] = useSearchParams();
  const online = useOnlineStatus();
  const shortlist = useShortlist();
  const ids = readIds(searchParams);
  const options = readOptions(searchParams);
  const facets = useAsync(() => api.facets(), []);
  const idsKey = ids.join(',');
  const compareQuery = useAsync(
    () => (ids.length > 0 ? api.compare(ids) : Promise.resolve({ items: [] })),
    [idsKey],
  );
  const [message, setMessage] = useState('');

  const savedById = new Map(shortlist.items.map((item) => [item.id, item]));
  const savedRecords = ids.map((id) => savedById.get(id)?.full).filter((item): item is Institution => Boolean(item));
  const canUseSnapshots =
    Boolean(compareQuery.error) && ids.length > 0 && savedRecords.length === ids.length;
  const records: Institution[] = canUseSnapshots
    ? savedRecords
    : (compareQuery.data?.items.map((item) => item.institution) ?? []);

  const result = useMemo(
    () => (records.length > 0 ? compareInstitutions(records, options) : null),
    [records, options],
  );

  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    setSearchParams(params);
  };

  const add = (id: string) => {
    if (ids.includes(id) || ids.length >= 4) return;
    update({ ids: [...ids, id].join(',') });
  };

  const remove = (id: string) => {
    const next = ids.filter((item) => item !== id);
    update({ ids: next.join(',') });
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'UniScope comparison', url });
        setMessage('Share sheet opened. Private notes are never included.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setMessage('Comparison link copied. It contains public comparison data only — no private notes.');
      } else {
        setMessage(`Copy this link: ${url}`);
      }
    } catch {
      setMessage('Share was cancelled.');
    }
  };

  const exportMarkdown = () => {
    if (!result) return;
    downloadText(
      exportFilename('uniscope-comparison', 'md'),
      buildComparisonMarkdown(records, result, options),
      'text/markdown',
    );
    setMessage('Markdown exported. Private notes are not included.');
  };

  const optionsForUi = { ...DEFAULT_COMPARE_OPTIONS, ...options };
  const hasFilters = Boolean(options.subject || options.degree);

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Comparison, not a league table</p>
        <h1>Compare universities</h1>
        <p className="page-sub">
          Choose 2–4 institutions. Set what matters, and UniScope will show which option is best supported — with the
          trade-offs and missing evidence visible. No quality score, no admission odds.
        </p>
      </header>

      <div className="compare-selected">
        <div className="compare-selected__chips">
          {ids.map((id) => {
            const record = records.find((item) => item.id === id);
            const saved = savedById.get(id);
            return (
              <span className="selected-chip" key={id}>
                <span>{record?.names.primary ?? saved?.summary.name ?? id}</span>
                <button type="button" onClick={() => remove(id)} aria-label={`Remove ${record?.names.primary ?? saved?.summary.name ?? id} from comparison`}>
                  ×
                </button>
              </span>
            );
          })}
          {ids.length === 0 ? <span className="cell-note">No institutions selected yet.</span> : null}
        </div>
        {ids.length < 4 ? <AddInstitution selected={ids} onAdd={add} max={4} /> : null}
      </div>

      {ids.length === 0 ? (
        <EmptyBlock title="Pick at least two institutions">
          <p>
            Use the search above, or start from your <Link to="/shortlist">saved shortlist</Link>. Comparisons use only
            source-checked facts; directory-only records can be compared for identity but not for fees or programmes.
          </p>
        </EmptyBlock>
      ) : null}

      {ids.length > 0 && compareQuery.loading ? <LoadingBlock label="Loading selected institutions" /> : null}
      {compareQuery.error && !canUseSnapshots ? (
        <ErrorBlock
          error={compareQuery.error}
          title="The comparison could not be loaded"
          onRetry={compareQuery.reload}
        />
      ) : null}
      {compareQuery.error && !canUseSnapshots && !online ? (
        <p className="footer-muted">
          Comparison needs a connection unless every selected institution has a saved full profile snapshot.
        </p>
      ) : null}

      {canUseSnapshots ? (
        <Notice tone="warning" title="Comparison uses saved snapshots">
          <p>
            The live service is unreachable, so this comparison uses saved public profiles from this device. Snapshots
            may be out of date. They contain no private notes. {shortlist.items.length > 0 ? `Oldest save: ${relativeSaved(shortlist.items[0]!.savedAt)}.` : ''}
          </p>
        </Notice>
      ) : null}

      {ids.length > 0 && records.length > 0 ? (
        <>
          <section className="compare-controls" aria-labelledby="priorities-title">
            <div className="section-head section-head--row">
              <div>
                <h2 id="priorities-title">What matters most?</h2>
                <p className="section-sub">Presets change the visible trade-offs. They do not change the facts.</p>
              </div>
              <div className="compare-actions">
                <button type="button" className="button button--secondary button--small" onClick={share}>
                  Share
                </button>
                <button type="button" className="button button--secondary button--small" onClick={exportMarkdown} disabled={!result}>
                  Export .md
                </button>
              </div>
            </div>
            <p className="visually-hidden" role="status" aria-live="polite">{message}</p>
            {message ? <p className="inline-status">{message}</p> : null}

            <div className="priority-grid" role="group" aria-label="Comparison priority">
              {COMPARE_PRIORITIES.map((priority) => (
                <button
                  key={priority.id}
                  type="button"
                  className={optionsForUi.priority === priority.id ? 'priority-card priority-card--active' : 'priority-card'}
                  aria-pressed={optionsForUi.priority === priority.id}
                  onClick={() => update({ p: priority.id === 'balanced' ? null : priority.id })}
                >
                  <strong>{priority.label}</strong>
                  <span>{priority.description}</span>
                </button>
              ))}
            </div>

            <details className="compare-options" open>
              <summary>Subject, degree, applicant category and hard requirements</summary>
              <div className="compare-options__grid">
                <div className="field">
                  <label htmlFor="compare-subject">Subject</label>
                  <select
                    id="compare-subject"
                    value={options.subject}
                    onChange={(event) => update({ subject: event.target.value })}
                  >
                    <option value="">Any subject</option>
                    {(facets.data?.subjects ?? []).map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.label} ({subject.institutionCount} institutions)
                      </option>
                    ))}
                  </select>
                  {facets.data && facets.data.subjects.length === 0 ? (
                    <p className="field-note">No subjects have source-checked programmes in this build.</p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor="compare-degree">Degree level</label>
                  <select
                    id="compare-degree"
                    value={options.degree}
                    onChange={(event) => update({ degree: event.target.value })}
                  >
                    <option value="">Not selected</option>
                    {DEGREE_LEVELS.map((level) => (
                      <option key={level.id} value={level.id}>{level.label}</option>
                    ))}
                  </select>
                  <p className="field-note">Required for a like-for-like cost comparison.</p>
                </div>

                <div className="field">
                  <label htmlFor="compare-category">Applicant category</label>
                  <select
                    id="compare-category"
                    value={options.applicantCategory}
                    onChange={(event) => update({ cat: event.target.value === 'international' ? null : event.target.value })}
                  >
                    {Object.entries(APPLICANT_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                  <p className="field-note">Fees are never mixed across applicant categories.</p>
                </div>

                <div className="field">
                  <label htmlFor="compare-country">Preferred country</label>
                  <select
                    id="compare-country"
                    value={options.countryPreference}
                    onChange={(event) => update({ prefCountry: event.target.value })}
                  >
                    <option value="">No preference</option>
                    {(facets.data?.countries ?? [])
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((country) => (
                        <option key={country.code} value={country.code}>{country.name}</option>
                      ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="compare-language">Preferred teaching language</label>
                  <select
                    id="compare-language"
                    value={options.languagePreference}
                    onChange={(event) => update({ prefLanguage: event.target.value })}
                  >
                    <option value="">No preference</option>
                    {(facets.data?.languages ?? []).map((language) => (
                      <option key={language.code} value={language.code}>{language.label}</option>
                    ))}
                  </select>
                  <p className="field-note">Only languages confirmed by listed programmes count.</p>
                </div>
              </div>

              <fieldset className="hard-requirements">
                <legend>Hard requirements</legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.requireProgram}
                    onChange={(event) => update({ reqProgram: event.target.checked ? '1' : null })}
                    disabled={!hasFilters}
                  />
                  <span>
                    Must have a matching source-checked programme
                    <small>{hasFilters ? 'Unconfirmed programme data is shown but not ranked.' : 'Choose a subject or degree first.'}</small>
                  </span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.requireCountry}
                    onChange={(event) => update({ reqCountry: event.target.checked ? '1' : null })}
                    disabled={!options.countryPreference}
                  />
                  <span>
                    Must be in the preferred country
                    <small>{options.countryPreference ? 'Country is a known directory field.' : 'Choose a preferred country first.'}</small>
                  </span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.requireSourceChecked}
                    onChange={(event) => update({ reqChecked: event.target.checked ? '1' : null })}
                  />
                  <span>
                    Source-checked profiles only
                    <small>Directory records are not treated as evidence of missing facts.</small>
                  </span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={options.requireFeeData}
                    onChange={(event) => update({ reqFee: event.target.checked ? '1' : null })}
                  />
                  <span>
                    Must have source-checked fee data
                    <small>This excludes records without a fee fact; it does not rank them as expensive.</small>
                  </span>
                </label>
              </fieldset>
            </details>
          </section>

          {result ? (
            <>
              <section className={`recommendation recommendation--${result.outcome.kind}`} aria-labelledby="recommendation-title">
                <p className="eyebrow">Not a quality ranking</p>
                <h2 id="recommendation-title">{result.outcome.title}</h2>
                <p>{result.outcome.detail}</p>
                {result.outcome.recommendedIds.length > 0 ? (
                  <div className="recommendation__ids">
                    {result.outcome.recommendedIds.map((id) => {
                      const evaluation = result.evaluations.find((item) => item.id === id);
                      return evaluation ? (
                        <Link key={id} className="chip chip--link" to={`/university/${id}`}>
                          {evaluation.name}
                        </Link>
                      ) : null;
                    })}
                  </div>
                ) : null}
                <div className="dimension-grid">
                  <div className={`dimension ${result.dimensions.cost.available ? 'dimension--available' : ''}`}>
                    <h3>Cost</h3>
                    <p>{result.dimensions.cost.detail}</p>
                    <span className="cell-note">{result.dimensions.cost.available ? 'Comparable' : 'Not comparable'}</span>
                  </div>
                  <div className={`dimension ${result.dimensions.subject.available ? 'dimension--available' : ''}`}>
                    <h3>Programme fit</h3>
                    <p>{result.dimensions.subject.detail}</p>
                    <span className="cell-note">{result.dimensions.subject.available ? 'Comparable' : 'Not comparable'}</span>
                  </div>
                  <div className={`dimension ${result.dimensions.location.available ? 'dimension--available' : ''}`}>
                    <h3>Location & language</h3>
                    <p>{result.dimensions.location.detail}</p>
                    <span className="cell-note">{result.dimensions.location.available ? 'Comparable' : 'Not comparable'}</span>
                  </div>
                </div>
              </section>

              <section className="compare-table-section" aria-labelledby="table-title">
                <div className="section-head section-head--row">
                  <h2 id="table-title">Side by side</h2>
                  <p className="cell-note">Swipe or scroll the table sideways. Missing cells say “Not available”.</p>
                </div>
                <div className="table-scroll compare-table-wrap">
                  <table className="compare-table">
                    <caption className="visually-hidden">
                      Comparison of {records.length} institutions. Missing data is marked Not available and is not treated as a negative value.
                    </caption>
                    <thead>
                      <tr>
                        <td />
                        {result.evaluations.map((evaluation) => (
                          <th scope="col" key={evaluation.id}>
                            <Link to={`/university/${evaluation.id}`}>{evaluation.name}</Link>
                            <div className="compare-table__badge">
                              <VerificationBadge level={evaluation.institution.verification.level === 'source-checked' ? 'official-source-checked' : 'directory-only'} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Country / city</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.institution.locations.find((location) => location.city)?.city
                              ? `${evaluation.institution.locations.find((location) => location.city)!.city}, `
                              : ''}
                            {evaluation.institution.country.name}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Institution type</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>{kindLabel(evaluation.institution.kind)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Matching programmes</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.programData === 'unavailable' ? (
                              <span className="missing">Programme data not available</span>
                            ) : evaluation.matchingPrograms.length === 0 ? (
                              <span className="missing">No matching programme listed</span>
                            ) : (
                              <ul className="cell-list">
                                {evaluation.matchingPrograms.slice(0, 4).map((program) => (
                                  <li key={program.id}>
                                    <Link to={`/university/${evaluation.id}#program-${program.id}`}>
                                      {program.name}
                                    </Link>
                                    <span className="cell-note"> {DEGREE_LEVELS.find((level) => level.id === program.degreeLevel)?.short}</span>
                                  </li>
                                ))}
                                {evaluation.matchingPrograms.length > 4 ? (
                                  <li className="cell-note">+{evaluation.matchingPrograms.length - 4} more</li>
                                ) : null}
                              </ul>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Annual fee (selected basis)</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.selectedFee ? (
                              <>
                                <strong>{formatFeeAmount(evaluation.selectedFee.fee.amount)}</strong>
                                <div className="cell-note">{feeContextLine(evaluation, optionsForUi)}</div>
                                <div className="cell-note">
                                  {evaluation.selectedFee.fee.academicYear} · {APPLICANT_LABELS[evaluation.selectedFee.fee.applicantCategory]}
                                  {evaluation.selectedFee.program ? ` · ${evaluation.selectedFee.program.name}` : ' · institution-wide'}
                                </div>
                                {evaluation.feeNotComparableReason ? (
                                  <div className="cell-note">{evaluation.feeNotComparableReason}</div>
                                ) : null}
                              </>
                            ) : (
                              <span className="missing">{evaluation.feeNotComparableReason ?? 'Not available'}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Deadlines for this applicant</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id} className="cell-note">
                            {deadlineSummary(
                              evaluation.institution,
                              evaluation.matchingPrograms.map((program) => program.id),
                              options.applicantCategory,
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Recognition</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.recognitionCount > 0 ? (
                              evaluation.institution.recognition.map((recognition) => recognition.body).join('; ')
                            ) : (
                              <span className="missing">Not source-checked</span>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Hard requirements</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.hardFailures.length === 0 && evaluation.hardUnknowns.length === 0 ? (
                              <Badge tone="positive">Confirmed</Badge>
                            ) : (
                              <>
                                {evaluation.hardFailures.map((reason) => <div className="cell-note" key={reason}>Not met: {reason}</div>)}
                                {evaluation.hardUnknowns.map((reason) => <div className="cell-note" key={reason}>Unconfirmed: {reason}</div>)}
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Last source read</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            {evaluation.lastCheckedAt ? formatDate(evaluation.lastCheckedAt) : <span className="missing">Not source-checked</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Sources</th>
                        {result.evaluations.map((evaluation) => (
                          <td key={evaluation.id}>
                            <Link to={`/university/${evaluation.id}#sources`}>
                              {evaluation.institution.sources.length} source{evaluation.institution.sources.length === 1 ? '' : 's'} on profile
                            </Link>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="compare-tradeoffs" aria-labelledby="tradeoffs-title">
                <h2 id="tradeoffs-title">Trade-offs</h2>
                <div className="tradeoff-grid">
                  {result.tradeoffs.map((tradeoff) => {
                    const record = records.find((item) => item.id === tradeoff.institutionId);
                    if (!record) return null;
                    return (
                      <article className="tradeoff-card" key={tradeoff.institutionId}>
                        <h3><Link to={`/university/${record.id}`}>{record.names.primary}</Link></h3>
                        <ul>
                          {tradeoff.texts.map((text) => <li key={text}>{text}</li>)}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="compare-gaps" aria-labelledby="gaps-title">
                <h2 id="gaps-title">What this comparison does not tell you</h2>
                <ul className="gap-list">
                  {result.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
                <p className="cell-note">
                  Comparison never uses private notes. Share links include only the selected public profiles and your
                  comparison settings.
                </p>
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {ids.length > 0 && !result && !compareQuery.loading ? (
        <p className="footer-muted">Add another institution to see a comparison.</p>
      ) : null}
    </div>
  );
}
