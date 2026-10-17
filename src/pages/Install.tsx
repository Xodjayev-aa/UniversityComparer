import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/hooks';
import { InstallPrompt } from '../components/InstallPrompt';
import { Notice } from '../components/States';

export function InstallPage() {
  usePageTitle('Install UniScope');
  return (
    <div className="container page page--narrow">
      <header className="page-head">
        <p className="eyebrow">Works like an app, stores data locally</p>
        <h1>Install UniScope on your phone</h1>
        <p className="page-sub">
          UniScope is an installable web app (PWA). Installation is optional: search, profiles and comparison work in a
          normal browser tab too. There is no app-store listing and no account.
        </p>
      </header>

      <InstallPrompt variant="page" />

      <section className="install-section" aria-labelledby="android-title">
        <h2 id="android-title">Android (Chrome, Edge, Samsung Internet)</h2>
        <ol className="steps">
          <li>Open UniScope in the browser over HTTPS.</li>
          <li>Use the <strong>Install</strong> button on this page if it appears, or the browser menu.</li>
          <li>Confirm <strong>Install</strong>. The icon appears on your home screen.</li>
        </ol>
        <p className="cell-note">
          If the button never appears, the browser may not consider the app installable (for example, an unsupported
          browser or a non-HTTPS address). The site still works normally.
        </p>
      </section>

      <section className="install-section" aria-labelledby="ios-title">
        <h2 id="ios-title">iPhone and iPad</h2>
        <ol className="steps">
          <li>Open UniScope in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose <strong>Add to Home Screen</strong>.</li>
        </ol>
        <p className="cell-note">Installation prompts are not available on every browser or platform.</p>
      </section>

      <section className="install-section" aria-labelledby="offline-title">
        <h2 id="offline-title">What works offline</h2>
        <ul className="check-list">
          <li>The app shell opens if it has been cached.</li>
          <li>Your locally saved shortlist remains available, with the date each item was saved.</li>
          <li>Saved profile snapshots can be reopened and are labelled as saved snapshots, not live data.</li>
          <li>Search, new profiles and new comparisons require a connection.</li>
          <li>Nothing is silently refreshed while you are offline, and the app does not pretend saved pages are current.</li>
        </ul>
        <p className="cell-note">
          Installed apps can be removed like any other app. Clearing site data also deletes your shortlist and private
          notes; there is no cloud backup.
        </p>
      </section>

      <Notice tone="info" title="No tracking, no account">
        <p>
          The installable app does not add analytics or an account requirement. See the <Link to="/privacy">privacy
          notice</Link> for exactly what is stored and where.
        </p>
      </Notice>
    </div>
  );
}
