import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync, usePageTitle } from '../lib/hooks';
import { formatDate, formatDateTime, formatNumber, plural, sourceAge } from '../lib/format';
import { EmptyBlock, ErrorBlock, LoadingBlock, Notice } from '../components/States';

export function CoveragePage() {
  usePageTitle('Coverage, sources and gaps');
  const result = useAsync(() => api.coverage(), []);
  const coverage = result.data;

  return (
    <div className="container page">
      <header className="page-head">
        <p className="eyebrow">Read this before trusting a number</p>
        <h1>Coverage, sources and gaps</h1>
        <p className="page-sub">
          UniScope is a discovery index with a small, source-checked layer on top. It is not a complete register of the
          world’s universities, and no count here should be read as one.
        </p>
      </header>

      {result.loading ? <LoadingBlock label="Loading coverage details" /> : null}
      {result.error ? <ErrorBlock error={result.error} title="Coverage details could not be loaded" onRetry={result.reload} /> : null}

      {coverage ? (
        <>
          <Notice tone="info" title={`Directory data as of ${formatDate(coverage.directoryAsOf)}`}>
            <p>
              This page was generated {formatDateTime(coverage.generatedAt)} ({sourceAge(coverage.generatedAt.slice(0, 10)).toLowerCase()}).
              “Generated” describes this build, not the currency of every linked page.
            </p>
          </Notice>

          <section aria-labelledby="totals-title">
            <h2 id="totals-title">What is in this build</h2>
            <dl className="stat-grid">
              <div className="stat">
                <dt>Records</dt>
                <dd>{formatNumber(coverage.totals.records)}</dd>
                <span>all directory records after de-duplication</span>
              </div>
              <div className="stat">
                <dt>University-scope records</dt>
                <dd>{formatNumber(coverage.totals.universityScope)}</dd>
                <span>ROR education types and Hipo university listings</span>
              </div>
              <div className="stat">
                <dt>Source-checked profiles</dt>
                <dd>{formatNumber(coverage.totals.sourceChecked)}</dd>
                <span>facts read from official pages</span>
              </div>
              <div className="stat">
                <dt>Programme facts</dt>
                <dd>{formatNumber(coverage.totals.programs)}</dd>
                <span>only from source-checked profiles</span>
              </div>
              <div className="stat">
                <dt>Fee facts</dt>
                <dd>{formatNumber(coverage.totals.feeFacts)}</dd>
                <span>contextual, not converted</span>
              </div>
              <div className="stat">
                <dt>Deadline facts</dt>
                <dd>{formatNumber(coverage.totals.deadlineFacts)}</dd>
                <span>dated claims with intake context</span>
              </div>
              <div className="stat">
                <dt>Recognition facts</dt>
                <dd>{formatNumber(coverage.totals.recognitionFacts)}</dd>
                <span>never inferred from directory inclusion</span>
              </div>
              <div className="stat">
                <dt>Countries</dt>
                <dd>{formatNumber(coverage.totals.countries)}</dd>
                <span>{formatNumber(coverage.totals.universityCountries)} with university-scope records</span>
              </div>
              <div className="stat">
                <dt>Records with a city</dt>
                <dd>{formatNumber(coverage.totals.recordsWithCity)}</dd>
                <span>missing city is not filled from guesses</span>
              </div>
              <div className="stat">
                <dt>Records with a website domain</dt>
                <dd>{formatNumber(coverage.totals.withDomains)}</dd>
                <span>used only to link out, not as proof of status</span>
              </div>
              <div className="stat">
                <dt>Official source pages read</dt>
                <dd>{formatNumber(coverage.totals.officialSourcePages)}</dd>
                <span>across {formatNumber(coverage.totals.officialSourceDomains)} official domains</span>
              </div>
              <div className="stat">
                <dt>Curated facts</dt>
                <dd>{formatNumber(coverage.totals.curatedFacts)}</dd>
                <span>individual sourced claims</span>
              </div>
            </dl>
          </section>

          <section aria-labelledby="gaps-title">
            <h2 id="gaps-title">Known gaps</h2>
            <p className="section-sub">
              These are deliberate statements of limitation. They are part of the product, not a disclaimer hidden in
              the footer.
            </p>
            <ul className="gap-list gap-list--coverage">
              {coverage.gaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
          </section>

          <section aria-labelledby="sources-title">
            <h2 id="sources-title">Sources, licences and what each is used for</h2>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Publisher</th>
                    <th scope="col">Release</th>
                    <th scope="col">Retrieved</th>
                    <th scope="col">Licence</th>
                    <th scope="col">Use and limits</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.sources.map((source) => (
                    <tr key={source.id}>
                      <th scope="row">
                        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                      </th>
                      <td>{source.publisher}</td>
                      <td>{source.release ?? 'Not stated'}</td>
                      <td>{formatDate(source.retrievedAt)}</td>
                      <td>
                        <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer">{source.license}</a>
                      </td>
                      <td>
                        {source.use}
                        <span className="cell-note"> {source.limitations}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="countries-title">
            <h2 id="countries-title">Country coverage</h2>
            <p className="section-sub">
              Counts are directory records, not the number of universities in a country. A country with zero records is
              a gap in this index.
            </p>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Country</th>
                    <th scope="col">Region</th>
                    <th scope="col">University-scope records</th>
                    <th scope="col">Source-checked profiles</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.countries
                    .slice()
                    .sort((a, b) => b.universityRecords - a.universityRecords || a.name.localeCompare(b.name))
                    .map((country) => (
                      <tr key={country.code}>
                        <th scope="row">
                          <Link to={`/countries/${country.code}`}>{country.name}</Link>
                        </th>
                        <td>{country.region}</td>
                        <td>{formatNumber(country.universityRecords)}</td>
                        <td>{country.sourceChecked > 0 ? formatNumber(country.sourceChecked) : 'None yet'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="history-title">
            <h2 id="history-title">Update history</h2>
            {coverage.updateHistory.length === 0 ? (
              <EmptyBlock title="No build history recorded">
                <p>The coverage file did not include history entries.</p>
              </EmptyBlock>
            ) : (
              <ol className="history-list">
                {coverage.updateHistory.map((entry) => (
                  <li key={entry.at}>
                    <strong>{formatDateTime(entry.at)}</strong>
                    <p>{entry.note}</p>
                    <p className="cell-note">
                      {entry.sources.map((source) => `${source.id} ${source.release ?? ''} (retrieved ${formatDate(source.retrievedAt)})`).join(' · ')}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="cell-note">
            Source-code licences and the full gap statement are also in the repository’s coverage document. This page
            reports what the current dataset contains; it does not certify its accuracy. {plural(coverage.gaps.length, 'gap')} recorded.
          </p>
        </>
      ) : null}
    </div>
  );
}
