import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMeta } from '../lib/meta';
import { useOnlineStatus, useShortlist } from '../lib/hooks';
import { formatDate, formatDateTime } from '../lib/format';
import { InstallPrompt } from './InstallPrompt';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link--active' : 'nav-link';
}

function RouteFocus() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      window.scrollTo(0, 0);
      return;
    }
    if (location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        element.scrollIntoView({ block: 'start' });
        element.focus?.();
        return;
      }
    }
    window.scrollTo(0, 0);
    const main = document.getElementById('main');
    main?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);
  return null;
}

function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <strong>You’re offline.</strong> Only saved snapshots are available. UniScope does not fetch or verify
      information while offline.
    </div>
  );
}

function Header() {
  const shortlist = useShortlist();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" to="/" aria-label="UniScope home">
          <img className="brand__mark" src="/icons/mark.svg" alt="" width="40" height="40" />
          <span className="brand__text">
            <span className="brand__name">UniScope</span>
            <span className="brand__tag">Facts, with receipts</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          <NavLink className={navClass} to="/search">
            Find
          </NavLink>
          <NavLink className={navClass} to="/compare">
            Compare
          </NavLink>
          <NavLink className={navClass} to="/shortlist">
            Saved
            {shortlist.items.length > 0 ? <span className="nav-count">{shortlist.items.length}</span> : null}
          </NavLink>
          <NavLink className={navClass} to="/coverage">
            Coverage
          </NavLink>
          <NavLink className={navClass} to="/about">
            About
          </NavLink>
        </nav>

        <div className="header-actions">
          <InstallPrompt />
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const shortlist = useShortlist();
  const location = useLocation();
  const exploreActive =
    location.pathname === '/' ||
    location.pathname.startsWith('/search') ||
    location.pathname.startsWith('/countries') ||
    location.pathname.startsWith('/subjects') ||
    location.pathname.startsWith('/university');
  return (
    <nav className="bottom-nav" aria-label="Mobile primary">
      <Link to="/search" className={exploreActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
        </svg>
        <span>Explore</span>
      </Link>
      <Link
        to="/compare"
        className={location.pathname.startsWith('/compare') ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 6h7M4 12h5M4 18h7M17 4v16m0 0-3-3m3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Compare</span>
      </Link>
      <Link
        to="/shortlist"
        className={location.pathname.startsWith('/shortlist') ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
      >
        <span className="bottom-nav__icon-wrap">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4-6.5 4v-14a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
          </svg>
          {shortlist.items.length > 0 ? <span className="bottom-nav__count">{shortlist.items.length}</span> : null}
        </span>
        <span>Saved</span>
      </Link>
      <Link
        to="/coverage"
        className={location.pathname.startsWith('/coverage') ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Data</span>
      </Link>
    </nav>
  );
}

function Footer() {
  const { meta } = useMeta();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="brand brand--footer" to="/" aria-label="UniScope home">
            <img className="brand__mark" src="/icons/mark.svg" alt="" width="36" height="36" />
            <span className="brand__name">UniScope</span>
          </Link>
          <p>
            University discovery and comparison with per-fact sources. Free, no account. Directory coverage is broad;
            source-checked depth is limited and clearly labelled.
          </p>
          <p className="footer-install">
            <InstallPrompt variant="footer" />
          </p>
        </div>

        <nav className="footer-col" aria-label="Explore">
          <h2>Explore</h2>
          <Link to="/search">Find universities</Link>
          <Link to="/countries">Countries</Link>
          <Link to="/subjects">Subjects</Link>
          <Link to="/compare">Compare</Link>
          <Link to="/shortlist">Saved shortlist</Link>
        </nav>

        <nav className="footer-col" aria-label="Trust and data">
          <h2>Trust & data</h2>
          <Link to="/coverage">Coverage & sources</Link>
          <Link to="/about">Methodology</Link>
          <Link to="/about#verification">Verification labels</Link>
          <Link to="/report">Report an issue</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>

        <div className="footer-col footer-col--data">
          <h2>Data status</h2>
          {meta ? (
            <>
              <p>
                Directory: <strong>{meta.coverage.directoryAsOf}</strong>
                <br />
                Source-checked profiles: <strong>{meta.coverage.totals.sourceChecked}</strong>
                <br />
                Dataset built: <strong>{formatDateTime(meta.generatedAt)}</strong>
              </p>
              <p className="footer-muted">
                Retrieved is not the same as updated. Official pages are read on the date shown on each fact.
              </p>
            </>
          ) : (
            <p className="footer-muted">Coverage information is temporarily unavailable.</p>
          )}
        </div>
      </div>

      <div className="container footer-legal">
        <p>
          UniScope is independent and not affiliated with any university, government or accreditation body. Information
          may be incomplete or out of date; always check the official page. Nothing here is admission, visa, scholarship
          or credential-recognition advice.
        </p>
        <p>
          Directory data: <a href="https://ror.readme.io/docs/data-dump" target="_blank" rel="noopener noreferrer">ROR</a>{' '}
          (CC0 1.0) and{' '}
          <a href="https://github.com/Hipo/university-domains-list" target="_blank" rel="noopener noreferrer">
            Hipo university-domains-list
          </a>{' '}
          (MIT). Original logo and application code are part of this project. Official-page facts link to their sources.
        </p>
        <p className="footer-muted">
          Privacy and terms are drafts, not a claim of legal approval or worldwide compliance. Last footer build:{' '}
          {meta ? formatDate(meta.generatedAt.slice(0, 10)) : '—'}.
        </p>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <OfflineBanner />
      <RouteFocus />
      <main id="main" tabIndex={-1} className="site-main">
        <Outlet />
      </main>
      <BottomNav />
      <Footer />
    </>
  );
}
