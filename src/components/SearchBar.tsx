import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function SearchBar({
  initialQuery = '',
  size = 'large',
  autoFocus = false,
}: {
  initialQuery?: string;
  size?: 'large' | 'compact';
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : '/search');
  };

  return (
    <form className={`search-bar search-bar--${size}`} role="search" onSubmit={submit}>
      <label className="visually-hidden" htmlFor={`university-search-${size}`}>
        Search by university name, alternate name, city or country
      </label>
      <span className="search-bar__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id={`university-search-${size}`}
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="University, alternate name, city or country"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={120}
        enterKeyHint="search"
      />
      <button type="submit" className="button button--primary search-bar__button">
        Search
      </button>
    </form>
  );
}
