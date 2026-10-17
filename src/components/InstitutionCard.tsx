import { Link } from 'react-router-dom';
import type { InstitutionSummary } from '../../shared/types';
import { DEGREE_LABELS, languageLabel, subjectLabel } from '../../shared/taxonomy';
import { countryAndCity, plural } from '../lib/format';
import { scopeBasisInfo } from '../lib/labels';
import { Badge, ScopeBadge, VerificationBadge } from './Badge';

export function InstitutionCard({
  summary,
  headingLevel = 2,
}: {
  summary: InstitutionSummary;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const basis = scopeBasisInfo(summary.listing.scopeBasis);
  const location = countryAndCity({
    country: summary.country,
    locations: summary.city
      ? [
          {
            city: summary.city,
            region: null,
            countryCode: summary.country.code,
            countryName: summary.country.name,
            latitude: null,
            longitude: null,
            role: 'primary',
            source: 'ror',
          },
        ]
      : [],
  });

  return (
    <article className="institution-card">
      <div className="institution-card__top">
        <div>
          <Heading className="institution-card__title">
            <Link to={`/university/${summary.id}`}>{summary.name}</Link>
          </Heading>
          <p className="institution-card__location">{location}</p>
        </div>
        <VerificationBadge level={summary.verificationLevel === 'source-checked' ? 'official-source-checked' : 'directory-only'} />
      </div>

      <div className="institution-card__badges">
        {summary.scope === 'education' ? <ScopeBadge scope="education" /> : null}
        {summary.programs.count > 0 ? (
          <>
            <Badge tone="outline">
              {plural(summary.programs.count, 'source-checked programme')}
            </Badge>
            {summary.programs.degreeLevels.slice(0, 2).map((level) => (
              <Badge key={level} tone="muted">
                {DEGREE_LABELS[level]}
              </Badge>
            ))}
            {summary.programs.languages.slice(0, 1).map((language) => (
              <Badge key={language} tone="muted">
                {languageLabel(language)}
              </Badge>
            ))}
          </>
        ) : (
          <Badge tone="muted">Programme data not available</Badge>
        )}
        {summary.hasFeeFacts ? <Badge tone="positive">Source-checked fee data</Badge> : <Badge tone="muted">No source-checked fee</Badge>}
      </div>

      {summary.programs.subjects.length > 0 ? (
        <p className="institution-card__subjects">
          Subjects listed: {summary.programs.subjects.slice(0, 3).map(subjectLabel).join(', ')}
          {summary.programs.subjects.length > 3 ? ` +${summary.programs.subjects.length - 3} more` : ''}
        </p>
      ) : null}

      {summary.verificationLevel === 'directory-only' ? (
        <p className="institution-card__note">
          We have not read this institution’s official pages. Programmes, fees, deadlines and recognition are not shown.
        </p>
      ) : null}

      {summary.matchedOn ? <p className="institution-card__match">Matched on {summary.matchedOn}</p> : null}

      <div className="institution-card__footer">
        <span className="scope-basis" title={basis.description}>
          {basis.label}
        </span>
        <Link className="text-link" to={`/university/${summary.id}`} aria-label={`View ${summary.name} profile`}>
          View profile <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
