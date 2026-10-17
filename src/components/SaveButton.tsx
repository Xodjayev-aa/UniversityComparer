import { useState } from 'react';
import type { Institution, InstitutionSummary } from '../../shared/types';
import { useShortlist } from '../lib/hooks';

export function SaveButton({
  summary,
  full = null,
  compact = false,
}: {
  summary: InstitutionSummary;
  full?: Institution | null;
  compact?: boolean;
}) {
  const shortlist = useShortlist();
  const saved = shortlist.items.some((item) => item.id === summary.id);
  const [message, setMessage] = useState('');

  const toggle = () => {
    if (saved) {
      shortlist.remove(summary.id);
      setMessage('Removed from your shortlist.');
    } else {
      shortlist.save(summary, full);
      setMessage('Saved on this device.');
    }
  };

  return (
    <span className="save-button-wrap">
      <button
        type="button"
        className={`button ${saved ? 'button--saved' : 'button--secondary'} ${compact ? 'button--icon' : 'button--small'}`}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${summary.name} from shortlist` : `Save ${summary.name} to shortlist`}
        title={saved ? 'Remove from shortlist' : 'Save to shortlist (stored on this device)'}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4-6.5 4v-14a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
        </svg>
        {compact ? null : <span>{saved ? 'Saved' : 'Save'}</span>}
      </button>
      {shortlist.error ? (
        <span className="inline-error" role="alert">
          {shortlist.error}
        </span>
      ) : null}
      <span className="visually-hidden" role="status" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
