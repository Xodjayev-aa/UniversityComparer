import type { ReactNode } from 'react';
import type { ListingScope, VerificationStatus } from '../../shared/types';
import { scopeBasisInfo, scopeInfo, verificationInfo } from '../lib/labels';

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'positive' | 'neutral' | 'caution' | 'muted' | 'outline';
  title?: string;
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function VerificationBadge({
  level,
  compact = false,
}: {
  level: VerificationStatus;
  compact?: boolean;
}) {
  const info = verificationInfo(level);
  return (
    <Badge tone={info.tone} title={info.description}>
      <span className="badge__dot" aria-hidden="true" />
      {compact && level === 'official-source-checked' ? 'Source-checked' : info.label}
    </Badge>
  );
}

export function ScopeBadge({ scope }: { scope: ListingScope }) {
  const info = scopeInfo(scope);
  if (scope === 'university') {
    return <Badge tone="outline">University scope</Badge>;
  }
  return (
    <Badge tone="caution" title={info.description}>
      Broader education record
    </Badge>
  );
}

export function ScopeBasis({ basis }: { basis: string }) {
  const info = scopeBasisInfo(basis);
  return (
    <span className="scope-basis" title={info.description}>
      {info.label}
    </span>
  );
}
