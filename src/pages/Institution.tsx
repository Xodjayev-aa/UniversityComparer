import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DegreeLevel, Institution, InstitutionSummary } from '../../shared/types';
import { DEGREE_LABELS, languageLabel, subjectLabel } from '../../shared/taxonomy';
import { api, ApiError } from '../lib/api';
import { useAsync, useOnlineStatus, usePageTitle, useShortlist } from '../lib/hooks';
import {
  countryAndCity,
  formatDate,
  formatDateTime,
  formatNumber,
  safeHttpUrl,
  sourceAge,
  relativeSaved,
} from '../lib/format';
import { kindLabel, scopeBasisInfo, verificationInfo } from '../lib/labels';
import { Badge, ScopeBadge, VerificationBadge } from '../components/Badge';
import { SaveButton } from '../components/SaveButton';
import { DeadlineList, FeeTable, LastChecked, ProgramCard, RecognitionCard, RequirementsList, ScholarshipCard } from '../components/Facts';
import { FactSource, SourceList } from '../components/Provenance';
import { BackLink, EmptyBlock, ErrorBlock, LoadingBlock, Missing, Notice } from '../components/States';

function degreeOrder(level: DegreeLevel): number {
  return ['bachelor', 'master', 'doctorate', 'non-degree'].indexOf(level);
}

function shareProfile(name: string, url: string): Promise<string> {
  if (navigator.share) {
    return navigator
      .share({ title: `${name} · UniScope`, text: `UniScope profile for ${name}`, url })
      .then(() => 'Share sheet opened.')
      .catch(() => 'Share cancelled.');
  }
  if (!navigator.clipboard) return Promise.resolve(`Copy this link: ${url}`);
  return navigator.clipboard
    .writeText(url)
    .then(() => 'Link copied. Private notes are never included.')
    .catch(() => `Copy this link: ${url}`);
}

export function InstitutionPage() {
  const { id } = useParams();
  const shortlist = useShortlist();
  const online = useOnlineStatus();
  const saved = id ? shortlist.get(id) : null;
  const result = useAsync(() => api.institution(id ?? ''), [id]);
  const name = result.data?.institution.names.primary;
  usePageTitle(name ?? saved?.summary.name ?? 'University profile');

  if (!id) {
    return (
      <div className="container page">
        <EmptyBlock title="No institution selected">
          <p>Choose an institution from search.</p>
        </EmptyBlock>
      </div>
    );
  }

  if (result.loading && !result.data) {
    return (
      <div className="container page">
        <LoadingBlock label="Loading profile" />
      </div>
    );
  }

  if (result.error && saved?.full) {
    return (
      <div className="container page">
        <Notice tone="warning" title="Saved snapshot — not live">
          <p>
            The live profile could not be loaded, so this is the public snapshot saved on{' '}
            <strong>{formatDateTime(saved.savedAt)}</strong>. {relativeSaved(saved.savedAt)} and it does not include
            anything researched since then. UniScope does not research while offline.
          </p>
          {!online ? <p>You appear to be offline. Search and fresh research require a connection.</p> : null}
        </Notice>
        <ProfileView
          institution={saved.full}
          summary={saved.summary}
          snapshot={{ savedAt: saved.savedAt }}
          online={online}
        />
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="container page">
        <BackLink to="/search">Back to search</BackLink>
        <ErrorBlock
          error={result.error}
          title={result.error instanceof ApiError && result.error.status === 404 ? 'Institution not found' : 'Profile could not be loaded'}
          onRetry={result.reload}
        />
        <p className="footer-muted">
          If you saved this institution, its snapshot is available in your <Link to="/shortlist">shortlist</Link>. A
          saved snapshot may be older than the live data.
        </p>
      </div>
    );
  }

  if (!result.data) return null;

  return (
    <div className="container page">
      <ProfileView
        institution={result.data.institution}
        summary={result.data.summary}
        online={online}
      />
    </div>
  );
}

function ProfileView({
  institution,
  summary,
  snapshot,
  online,
}: {
  institution: Institution;
  summary: InstitutionSummary;
  snapshot?: { savedAt: string };
  online: boolean;
}) {
  const [shareMessage, setShareMessage] = useState('');
  const [degreeFilter, setDegreeFilter] = useState<DegreeLevel | 'all'>('all');
  const sourceChecked = institution.verification.level === 'source-checked';
  const basis = scopeBasisInfo(institution.listing.scopeBasis);
  const website = safeHttpUrl(institution.website);
  const city = institution.locations.find((location) => location.city)?.city ?? null;
  const aliases = [...new Set(institution.names.aliases)].filter(
    (name) => name.toLowerCase() !== institution.names.primary.toLowerCase(),
  );
  const localNames = institution.names.localNames.filter(
    (name) => name.value.toLowerCase() !== institution.names.primary.toLowerCase(),
  );
  const officialName =
    institution.names.official && institution.names.official !== institution.names.primary
      ? institution.names.official
      : null;

  const programDegreeLevels = [...new Set(institution.programs.map((program) => program.degreeLevel))].sort(
    (a, b) => degreeOrder(a) - degreeOrder(b),
  );
  const filteredPrograms = useMemo(
    () =>
      institution.programs
        .filter((program) => degreeFilter === 'all' || program.degreeLevel === degreeFilter)
        .sort(
          (a, b) =>
            degreeOrder(a.degreeLevel) - degreeOrder(b.degreeLevel) ||
            a.name.localeCompare(b.name),
        ),
    [institution.programs, degreeFilter],
  );
  const programFeeCount = institution.programs.reduce((sum, program) => sum + program.tuition.length, 0);
  const programDeadlineCount = institution.programs.reduce((sum, program) => sum + program.deadlines.length, 0);
  const feeCount = institution.tuition.length + programFeeCount;
  const deadlineCount = institution.admissions.deadlines.length + programDeadlineCount;
  const dataNotes = [
    ...new Set([
      ...institution.dataNotes,
      ...(institution.locations.some((location) => location.city) ? [] : ['No city is recorded in the source directory.']),
      ...(institution.programs.length === 0 ? ['No source-checked programme list is available in this release.'] : []),
      ...(feeCount === 0 ? ['No source-checked fee fact is available in this release. Missing fees are not zero.'] : []),
      ...(institution.recognition.length === 0
        ? ['No source-checked recognition or accreditation entry is available. Absence is not evidence of non-accreditation.']
        : []),
    ]),
  ];

  const url = typeof window === 'undefined' ? '' : window.location.href;
  const compareAvailable = online && !snapshot;

  return (
    <>
      <BackLink to="/search">Back to search</BackLink>

      {snapshot ? (
        <Notice tone="warning" title="Saved snapshot — not live">
          <p>
            Showing the public information saved on {formatDateTime(snapshot.savedAt)}. Saved snapshots can be out of
            date. Always check the official page before acting.
          </p>
        </Notice>
      ) : null}

      <header className="profile-head">
        <div className="profile-head__main">
          <div className="badge-row">
            <VerificationBadge level={sourceChecked ? 'official-source-checked' : 'directory-only'} />
            <ScopeBadge scope={institution.scope} />
            {institution.kind !== 'not-classified' ? <Badge tone="outline">{kindLabel(institution.kind)}</Badge> : null}
          </div>
          <h1>{institution.names.primary}</h1>
          {officialName ? <p className="profile-official-name">Official name: {officialName}</p> : null}
          <p className="profile-location">
            {city ? `${city}, ` : ''}
            {institution.country.name}
            {website ? (
              <>
                {' · '}
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {new URL(website).hostname.replace(/^www\./, '')}
                  <span className="visually-hidden"> (official website, opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </p>
          <p className="profile-basis">{basis.label} · {basis.description}</p>

          <div className="profile-actions">
            <SaveButton summary={summary} full={institution} />
            {compareAvailable ? (
              <Link className="button button--secondary button--small" to={`/compare?ids=${institution.id}`}>
                Compare
              </Link>
            ) : (
              <button type="button" className="button button--secondary button--small" disabled title="Comparison needs a connection">
                Compare
              </button>
            )}
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={async () => setShareMessage(await shareProfile(institution.names.primary, url))}
            >
              Share
            </button>
            {snapshot ? null : (
              <Link className="button button--ghost button--small" to={`/report?institution=${institution.id}`}>
                Report an issue
              </Link>
            )}
          </div>
          <p className="visually-hidden" role="status" aria-live="polite">
            {shareMessage}
          </p>
          {shareMessage ? <p className="inline-status">{shareMessage}</p> : null}
        </div>

        <aside className="profile-head__check" aria-label="Verification summary">
          <h2 className="profile-head__check-title">
            {sourceChecked ? 'Official pages, read by a person' : 'No official page checked'}
          </h2>
          <p>
            {sourceChecked
              ? 'Every displayed researched fact links to its source and read date. This is not a live feed and not a guarantee of currentness.'
              : 'This is a discovery record. Programmes, fees, deadlines and recognition are not claimed because we have not read the official pages for this release.'}
          </p>
          {sourceChecked ? (
            <dl className="mini-dl">
              <div>
                <dt>Last source read</dt>
                <dd><LastChecked institution={institution} /></dd>
              </div>
              <div>
                <dt>Sources</dt>
                <dd>{institution.sources.length}</dd>
              </div>
            </dl>
          ) : (
            <Badge tone="neutral">Directory record</Badge>
          )}
          {!online ? <p className="cell-note">Offline: this page cannot refresh.</p> : null}
        </aside>
      </header>

      {(aliases.length > 0 || localNames.length > 0 || institution.names.formerNames.length > 0) ? (
        <details className="name-variants">
          <summary>
            Alternate, local-script and former names ({aliases.length + localNames.length + institution.names.formerNames.length})
          </summary>
          <div className="name-variants__grid">
            {aliases.length > 0 ? (
              <div>
                <h2>Alternate names</h2>
                <ul>{aliases.map((name) => <li key={name} dir="auto">{name}</li>)}</ul>
              </div>
            ) : null}
            {localNames.length > 0 ? (
              <div>
                <h2>Local-script names</h2>
                <ul>
                  {localNames.map((name) => (
                    <li key={`${name.lang}-${name.value}`} lang={name.lang} dir="auto">
                      {name.value}
                      <span className="cell-note"> {name.lang}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {institution.names.formerNames.length > 0 ? (
              <div>
                <h2>Former names</h2>
                <ul>{institution.names.formerNames.map((name) => <li key={name} dir="auto">{name}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {!sourceChecked ? (
        <Notice tone="warning" title="Directory record only">
          <p>
            UniScope has not read this institution’s official pages. Programmes, fees, deadlines and accreditation are
            therefore shown as <strong>Not available</strong> — not as zero, and not as “none”. Directory inclusion is
            not accreditation.
          </p>
          <p>
            {website ? (
              <>
                Use the <a href={website} target="_blank" rel="noopener noreferrer">official website</a> for current
                admissions and fees.
              </>
            ) : (
              'No official website is recorded in the directory sources for this record.'
            )}
          </p>
        </Notice>
      ) : null}

      {sourceChecked ? (
        <nav className="profile-nav" aria-label="Profile sections">
          <a href="#overview">Overview</a>
          <a href="#programmes">Programmes</a>
          <a href="#costs">Costs</a>
          <a href="#admissions">Admissions</a>
          <a href="#recognition">Recognition</a>
          <a href="#sources">Sources</a>
        </nav>
      ) : null}

      <div className="profile-layout">
        <div className="profile-main">
          <section id="overview" className="profile-section" aria-labelledby="overview-title">
            <h2 id="overview-title">Overview</h2>
            <dl className="fact-dl">
              <div>
                <dt>Country</dt>
                <dd>{institution.country.name}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{city ?? <Missing>Not available in the directory data</Missing>}</dd>
              </div>
              <div>
                <dt>Institution type</dt>
                <dd>
                  {institution.kind === 'not-classified' ? (
                    <Missing>Not classified in this release</Missing>
                  ) : (
                    kindLabel(institution.kind)
                  )}
                </dd>
              </div>
              <div>
                <dt>Founded</dt>
                <dd>
                  {institution.established ? (
                    <>
                      {institution.established}
                      {' '}
                      <span className="cell-note">(year recorded in the ROR directory; not independently checked here)</span>
                    </>
                  ) : (
                    <Missing>Not available</Missing>
                  )}
                </dd>
              </div>
              <div>
                <dt>Teaching languages</dt>
                <dd>
                  {institution.languages.length > 0
                    ? institution.languages.map(languageLabel).join(', ')
                    : <Missing>Not available (no source-checked programme language)</Missing>}
                </dd>
              </div>
              <div>
                <dt>Study modes</dt>
                <dd>
                  {institution.studyModes.length > 0
                    ? institution.studyModes.map((mode) => (mode === 'full-time' ? 'Full-time' : 'Part-time')).join(', ')
                    : <Missing>Not available (no source-checked programme mode)</Missing>}
                </dd>
              </div>
              <div>
                <dt>Official website</dt>
                <dd>
                  {website ? (
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      {website}
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <Missing>Not available</Missing>
                  )}
                </dd>
              </div>
              <div>
                <dt>Directory basis</dt>
                <dd>
                  {basis.label}
                  {institution.rorId ? (
                    <>
                      {' · '}
                      <a href={institution.rorId} target="_blank" rel="noopener noreferrer">
                        ROR record
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            </dl>

            {institution.campuses.length > 0 ? (
              <div className="subsection">
                <h3>Campuses confirmed by an official source</h3>
                <ul className="plain-list">
                  {institution.campuses.map((campus) => (
                    <li key={campus.id}>
                      <strong>{campus.name}</strong>
                      {campus.city ? ` · ${campus.city}` : ''}
                      <FactSource source={campus.source} compact />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {institution.locations.length > 0 ? (
              <div className="subsection">
                <h3>Directory-recorded locations</h3>
                <p className="cell-note">
                  These locations come from ROR and are not confirmed as campuses unless an official source says so.
                </p>
                <ul className="plain-list">
                  {institution.locations.map((location, index) => (
                    <li key={`${location.city ?? 'unknown'}-${index}`}>
                      {location.city ?? 'City not recorded'}
                      {location.region ? `, ${location.region}` : ''}
                      {` · ${location.countryName} `}
                      <span className="cell-note">({location.source} record)</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {institution.admissions.links.length > 0 ? (
              <div className="subsection">
                <h3>Official links</h3>
                <ul className="link-list">
                  {institution.admissions.links.map((link) => (
                    <li key={link.id}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.label}
                        <span aria-hidden="true"> ↗</span>
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                      <span className="cell-note"> {link.kind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {dataNotes.length > 0 ? (
              <details className="data-notes">
                <summary>Record notes and known gaps</summary>
                <ul>{dataNotes.map((note) => <li key={note}>{note}</li>)}</ul>
              </details>
            ) : null}
          </section>

          {sourceChecked ? (
            <>
              <section id="programmes" className="profile-section" aria-labelledby="programmes-title">
                <h2 id="programmes-title">Programmes</h2>
                <p className="section-sub">
                  Only source-checked programmes are listed. This is a selective sample, not a complete catalogue. A
                  missing programme is not evidence that it is not offered.
                </p>
                {institution.programs.length === 0 ? (
                  <EmptyBlock title="No source-checked programmes in this release">
                    <p>
                      This profile has official-page facts but no programme list yet. The programme section stays empty
                      rather than being filled from memory or an unrelated directory.
                    </p>
                  </EmptyBlock>
                ) : (
                  <>
                    <div className="filter-chips" role="group" aria-label="Filter programmes by degree level">
                      <button
                        type="button"
                        className={degreeFilter === 'all' ? 'chip chip--active' : 'chip'}
                        aria-pressed={degreeFilter === 'all'}
                        onClick={() => setDegreeFilter('all')}
                      >
                        All degrees <span className="chip__count">{institution.programs.length}</span>
                      </button>
                      {programDegreeLevels.map((level) => {
                        const count = institution.programs.filter((program) => program.degreeLevel === level).length;
                        return (
                          <button
                            key={level}
                            type="button"
                            className={degreeFilter === level ? 'chip chip--active' : 'chip'}
                            aria-pressed={degreeFilter === level}
                            onClick={() => setDegreeFilter(level)}
                          >
                            {DEGREE_LABELS[level]} <span className="chip__count">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="program-list">
                      {filteredPrograms.map((program) => (
                        <ProgramCard key={program.id} program={program} />
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section id="costs" className="profile-section" aria-labelledby="costs-title">
                <h2 id="costs-title">Costs</h2>
                <p className="section-sub">
                  Fees are contextual: the programme, applicant category, academic year and unit matter. Figures are
                  shown in the original currency. No exchange rate or conversion is applied in this release.
                </p>
                <h3>Institution-wide fee facts</h3>
                <FeeTable facts={institution.tuition} />
                {programFeeCount > 0 ? (
                  <p className="cell-note">
                    {formatNumber(programFeeCount)} programme-level fee fact{programFeeCount === 1 ? '' : 's'} appear
                    inside the programme cards above.
                  </p>
                ) : null}

                <h3>Scholarships and funding</h3>
                {institution.scholarships.length > 0 ? (
                  <div className="card-stack">
                    {institution.scholarships.map((scholarship) => (
                      <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
                    ))}
                  </div>
                ) : (
                  <p className="data-empty">
                    No source-checked scholarship information in this release. This does not mean no scholarships
                    exist. Check the official funding pages.
                  </p>
                )}
              </section>

              <section id="admissions" className="profile-section" aria-labelledby="admissions-title">
                <h2 id="admissions-title">Admissions</h2>
                <Notice tone="info">
                  Requirements and deadlines are shown for the intake and applicant category recorded on each fact.
                  University-wide deadlines are separate from programme-specific deadlines. This is not admission advice
                  or a prediction.
                </Notice>
                <h3>Admission requirements</h3>
                <RequirementsList requirements={institution.admissions.requirements} />
                <h3>University-wide deadlines</h3>
                <DeadlineList deadlines={institution.admissions.deadlines} />
                <p className="cell-note">
                  Programme-specific deadlines appear in the programme cards ({programDeadlineCount} source-checked
                  programme deadline fact{programDeadlineCount === 1 ? '' : 's'}).
                </p>
                {institution.admissions.links.length > 0 ? (
                  <div className="subsection">
                    <h3>Apply or check official pages</h3>
                    <ul className="link-list">
                      {institution.admissions.links.map((link) => (
                        <li key={link.id}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.label}
                            <span aria-hidden="true"> ↗</span>
                            <span className="visually-hidden"> (opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section id="recognition" className="profile-section" aria-labelledby="recognition-title">
                <h2 id="recognition-title">Recognition and accreditation</h2>
                <p className="section-sub">
                  Only entries read from an official university or authority page are listed. Directory inclusion is
                  never treated as accreditation. Absence of an entry means “not checked in this release”.
                </p>
                {institution.recognition.length > 0 ? (
                  <div className="card-stack">
                    {institution.recognition.map((recognition) => (
                      <RecognitionCard key={recognition.id} recognition={recognition} />
                    ))}
                  </div>
                ) : (
                  <p className="data-empty">
                    No source-checked recognition or accreditation entry is available for this institution. This is
                    not evidence that it is unaccredited.
                  </p>
                )}
              </section>

              <section id="sources" className="profile-section" aria-labelledby="sources-title">
                <h2 id="sources-title">Sources</h2>
                <p className="section-sub">
                  “Read on” is when a person opened the linked page. It is not an “updated today” claim. Pages can
                  change after we read them.
                </p>
                <SourceList sources={institution.sources} />
                <p className="cell-note">
                  See the public <Link to="/coverage">coverage page</Link> for source versions, licences, known gaps and
                  build history.
                </p>
                {dataNotes.length > 0 ? (
                  <details className="data-notes">
                    <summary>Record notes and known gaps</summary>
                    <ul>{dataNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                  </details>
                ) : null}
              </section>
            </>
          ) : (
            <section id="official" className="profile-section" aria-labelledby="official-title">
              <h2 id="official-title">Find official information</h2>
              <p>
                We do not know the current programme catalogue, fees, deadlines or accreditation for this record.
                These links go to the directory record and the official website, not to verified answers.
              </p>
              <ul className="link-list">
                {website ? (
                  <li>
                    <a href={website} target="_blank" rel="noopener noreferrer">
                      Official website
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </li>
                ) : null}
                {institution.rorId ? (
                  <li>
                    <a href={institution.rorId} target="_blank" rel="noopener noreferrer">
                      ROR record
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </li>
                ) : null}
              </ul>
              {dataNotes.length > 0 ? (
                <details className="data-notes" open>
                  <summary>Record notes and known gaps</summary>
                  <ul>{dataNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                </details>
              ) : null}
            </section>
          )}
        </div>

        <aside className="profile-aside" aria-label="At a glance">
          <div className="aside-card">
            <h2>At a glance</h2>
            <dl className="aside-dl">
              <div>
                <dt>Profile status</dt>
                <dd>
                  <VerificationBadge level={sourceChecked ? 'official-source-checked' : 'directory-only'} />
                </dd>
              </div>
              <div>
                <dt>Country and city</dt>
                <dd>{countryAndCity(institution)}</dd>
              </div>
              <div>
                <dt>Source-checked programmes</dt>
                <dd>{institution.programs.length > 0 ? formatNumber(institution.programs.length) : 'None in this release'}</dd>
              </div>
              <div>
                <dt>Source-checked fee facts</dt>
                <dd>{feeCount > 0 ? formatNumber(feeCount) : 'None in this release'}</dd>
              </div>
              <div>
                <dt>Source-checked deadlines</dt>
                <dd>{deadlineCount > 0 ? formatNumber(deadlineCount) : 'None in this release'}</dd>
              </div>
              <div>
                <dt>Recognition entries</dt>
                <dd>{institution.recognition.length > 0 ? formatNumber(institution.recognition.length) : 'None in this release'}</dd>
              </div>
              <div>
                <dt>Sources listed</dt>
                <dd>{institution.sources.length}</dd>
              </div>
            </dl>
            {sourceChecked && institution.verification.lastCheckedAt ? (
              <p className="aside-note">
                Last source read {formatDate(institution.verification.lastCheckedAt)} ({sourceAge(institution.verification.lastCheckedAt).toLowerCase()}).
              </p>
            ) : (
              <p className="aside-note">No official page was read for this release.</p>
            )}
          </div>

          <div className="aside-card aside-card--plain">
            <h2>Reading this profile</h2>
            <ul className="check-list">
              <li>Directory listing ≠ accreditation.</li>
              <li>Missing data is not zero, and not a finding of absence.</li>
              <li>Fees are not converted; original currencies only.</li>
              <li>Programme lists are selective.</li>
              <li>No ranking or admission prediction is produced.</li>
            </ul>
            <Link className="text-link" to="/about">How the data works →</Link>
          </div>

          <div className="aside-card aside-card--plain">
            <h2>See also</h2>
            <ul className="link-list">
              <li><Link to={`/compare?ids=${institution.id}`}>Compare this institution</Link></li>
              <li><Link to={`/search?q=${encodeURIComponent(institution.names.primary)}`}>Search similar names</Link></li>
              <li><Link to="/coverage">Coverage and sources</Link></li>
              {!snapshot ? <li><Link to={`/report?institution=${institution.id}`}>Report an issue</Link></li> : null}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
