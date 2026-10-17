import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({
  error,
  title = 'Something went wrong',
  onRetry,
}: {
  error: Error | string | null;
  title?: string;
  onRetry?: () => void;
}) {
  const message = typeof error === 'string' ? error : error?.message;
  return (
    <div className="state-block state-block--error" role="alert">
      <div className="state-block__icon" aria-hidden="true">!</div>
      <div>
        <h2>{title}</h2>
        <p>{message ?? 'The information could not be loaded.'}</p>
        {onRetry ? (
          <button type="button" className="button button--secondary button--small" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyBlock({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state-block state-block--empty">
      <div className="state-block__icon" aria-hidden="true">∅</div>
      <div>
        <h2>{title}</h2>
        {children ? <div className="state-block__body">{children}</div> : null}
        {action ? <div className="state-block__actions">{action}</div> : null}
      </div>
    </div>
  );
}

export function Notice({
  children,
  title,
  tone = 'info',
}: {
  children: ReactNode;
  title?: string;
  tone?: 'info' | 'warning' | 'success';
}) {
  return (
    <aside className={`notice notice--${tone}`} role={tone === 'warning' ? 'note' : undefined}>
      <div className="notice__mark" aria-hidden="true">
        {tone === 'warning' ? '!' : tone === 'success' ? '✓' : 'i'}
      </div>
      <div>
        {title ? <h3 className="notice__title">{title}</h3> : null}
        <div className="notice__body">{children}</div>
      </div>
    </aside>
  );
}

export function Missing({ children = 'Not available' }: { children?: ReactNode }) {
  return <span className="missing">{children}</span>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="back-link" to={to}>
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}
