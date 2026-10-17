import { Link } from 'react-router-dom';
import { SUBJECTS } from '../../shared/taxonomy';
import { api } from '../lib/api';
import { useAsync, usePageTitle } from '../lib/hooks';
import { formatNumber, plural } from '../lib/format';
import { EmptyBlock, ErrorBlock, LoadingBlock, Notice } from '../components/States';

export function SubjectsPage() {
  usePageTitle('Browse by subject');
  const facets = useAsync(() => api.facets(), []);
  const subjects = facets.data?.subjects ?? [];
  const withProgrammes = subjects.filter((subject) => subject.programCount > 0);

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Fields, not rankings</p>
        <h1>Browse by subject</h1>
        <p className="page-sub">
          Subjects appear only where a source-checked programme was classified into them. Most directory records have
          no programme data, so this page is much smaller than the directory — and it is not a list of “best” places to
          study.
        </p>
      </header>

      {facets.loading ? <LoadingBlock label="Loading subjects" /> : null}
      {facets.error ? <ErrorBlock error={facets.error} title="Subjects could not be loaded" onRetry={facets.reload} /> : null}

      {facets.data ? (
        <>
          {withProgrammes.length === 0 ? (
            <EmptyBlock title="No subject-checked programmes yet">
              <p>
                The directory build has no programme facts in this release, so no subject is populated. We do not infer
                subjects from institution names or third-party marketing pages.
              </p>
              <p>
                You can still browse <Link to="/countries">countries</Link> or search the directory.
              </p>
            </EmptyBlock>
          ) : (
            <ul className="subject-grid">
              {withProgrammes.map((subject) => {
                const meta = SUBJECTS.find((item) => item.id === subject.id);
                return (
                  <li key={subject.id}>
                    <Link className="subject-card" to={`/search?subject=${subject.id}&scope=university`}>
                      <h2>{subject.label}</h2>
                      <p>{meta?.blurb ?? 'No description'}</p>
                      <dl className="subject-card__stats">
                        <div>
                          <dt>Institutions</dt>
                          <dd>{formatNumber(subject.institutionCount)}</dd>
                        </div>
                        <div>
                          <dt>Programme facts</dt>
                          <dd>{formatNumber(subject.programCount)}</dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <section className="coverage-callout" aria-labelledby="no-subject-title">
            <h2 id="no-subject-title">Why some subjects are empty</h2>
            <p>
              A programme is only listed when we read it on an official university page and recorded its source and
              read date. {formatNumber(facets.data.totals.programs)} programme facts exist in this build across{' '}
              {formatNumber(facets.data.totals.countries)} countries. Absence of a subject is a research gap, not a
              finding about any institution.
            </p>
            <Link className="text-link" to="/coverage">See coverage, sources and gaps →</Link>
          </section>
        </>
      ) : null}

      {facets.data && withProgrammes.length > 0 ? (
        <Notice>
          Subject labels are UniScope’s own grouping, not a national or publisher classification. Comparisons across
          subjects are not quality comparisons.
        </Notice>
      ) : null}
      <p className="cell-note">{plural(subjects.length, 'subject')} in the taxonomy, {plural(withProgrammes.length, 'subject')} with facts in this release.</p>
    </div>
  );
}
