import type { SourceRef } from '../../shared/types';
import { formatDate, safeHttpUrl, sourceAge, sourceAgeWarning, sourceLabel } from '../lib/format';

export function FactSource({ source, compact = false }: { source: SourceRef; compact?: boolean }) {
  const url = safeHttpUrl(source.url);
  const warning = sourceAgeWarning(source.retrievedAt);
  return (
    <div className={`fact-source${compact ? ' fact-source--compact' : ''}`}>
      <div className="fact-source__link">
        <span className="fact-source__label">Source:</span>{' '}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {source.title}
            <span className="external-mark" aria-hidden="true"> ↗</span>
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        ) : (
          <span>{source.title}</span>
        )}
      </div>
      <div className="fact-source__dates">
        <span>Read {formatDate(source.retrievedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{sourceAge(source.retrievedAt)}</span>
        {source.publishedAt ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Source date: {source.publishedAt}</span>
          </>
        ) : null}
        {source.effectiveAt ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Applies to: {source.effectiveAt}</span>
          </>
        ) : null}
      </div>
      {!compact && source.publisher ? <div className="fact-source__publisher">{source.publisher}</div> : null}
      {warning ? <div className="fact-source__warning">{warning}</div> : null}
    </div>
  );
}

export function SourceList({ sources }: { sources: SourceRef[] }) {
  const seen = new Set<string>();
  const unique = sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
  return (
    <div className="source-list">
      {unique.map((source) => {
        const url = safeHttpUrl(source.url);
        return (
          <article className="source-item" key={source.url}>
            <h3 className="source-item__title">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {sourceLabel(source)}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              ) : (
                source.title
              )}
            </h3>
            <p className="source-item__meta">
              Read {formatDate(source.retrievedAt)} · {sourceAge(source.retrievedAt)}
              {source.publishedAt ? ` · Source date: ${source.publishedAt}` : ''}
              {source.effectiveAt ? ` · Applies to: ${source.effectiveAt}` : ''}
            </p>
            {sourceAgeWarning(source.retrievedAt) ? (
              <p className="source-item__warning">{sourceAgeWarning(source.retrievedAt)}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
