import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/hooks';
import { Notice } from '../components/States';

export function PrivacyPage() {
  usePageTitle('Privacy notice');
  return (
    <div className="container page page--narrow prose">
      <header className="page-head">
        <p className="eyebrow">Draft · plain language</p>
        <h1>Privacy notice</h1>
        <p className="page-sub">
          Short version: no account, no analytics, no advertising. Your shortlist and notes stay in your browser. The
          only personal data we may receive is what you choose to type into a correction report.
        </p>
      </header>

      <Notice tone="warning" title="Draft, not a legal certification">
        <p>
          This is a good-faith draft written for a small independent service. It is not legal advice, and UniScope does
          not claim regulatory approval or worldwide compliance. If you need certainty for a high-risk use, consult a
          qualified professional.
        </p>
      </Notice>

      <h2>What stays on your device</h2>
      <ul>
        <li>
          <strong>Shortlist:</strong> institution IDs, a public summary, and — if you open the profile while online — a
          saved public snapshot. Stored in this browser’s <code>localStorage</code> under a UniScope-specific key.
        </li>
        <li>
          <strong>Private notes:</strong> stored in the same local storage. They are excluded from comparison, share
          links, and exports unless you explicitly choose to include them in a CSV export.
        </li>
        <li>
          <strong>Offline cache:</strong> the app shell and static assets cached by the service worker so the app can
          open without a network. Saved pages are not silently refreshed while offline.
        </li>
      </ul>
      <p>
        There is no account and no server-side copy of your shortlist. If you clear site data, uninstall the app, or use
        private browsing, the shortlist and notes are deleted and cannot be restored by us.
      </p>

      <h2>What our server receives</h2>
      <ul>
        <li>
          <strong>Requests:</strong> like most web servers, the hosting provider may process IP addresses, timestamps,
          requested paths and a user agent to deliver the site and protect it from abuse. Retention depends on the
          deployment; this project does not build its own analytics profile, and there is no third-party analytics
          script in the client.
        </li>
        <li>
          <strong>Rate limiting:</strong> a small number of recent request timestamps per IP may be held in memory for
          abuse prevention. These are not used for profiling and disappear on restart.
        </li>
        <li>
          <strong>Correction reports:</strong> the issue details you write, the page and institution involved, an
          optional source URL, and an optional email address. Reports are stored in a server-side queue for human
          review. Do not include personal data about other people.
        </li>
        <li>
          <strong>Admin session:</strong> a signed, HttpOnly cookie is set only after a maintainer enters the admin
          token. It is not used for ordinary visitors.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>No advertising, tracking pixels, cross-site profiling or sale of personal data.</li>
        <li>No account, email marketing or newsletter.</li>
        <li>No AI service receives your shortlist, notes or search history in this release.</li>
        <li>No third-party fonts or CDNs are required by the core pages; the app uses system fonts and local assets.</li>
      </ul>

      <h2>Legal bases, where they apply</h2>
      <p>
        Where a legal basis is required, the intended bases are: legitimate interest in operating and securing the
        service (server logs, rate limiting); consent or explicit submission for correction reports; and your own
        action for locally stored data. This draft is not a claim that every jurisdiction’s requirements have been met.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Clear site data at any time to remove the shortlist, notes and offline cache.</li>
        <li>Submit a correction report without an email address; only include contact details if you want a reply.</li>
        <li>Ask for a correction report containing your email to be deleted by using the report form and referencing the report’s reference code.</li>
        <li>Use the site without installing it or saving anything.</li>
      </ul>

      <h2>Data locations and retention</h2>
      <p>
        Correction reports are kept until reviewed and for a reasonable period afterwards to understand data quality.
        Hosting and database locations depend on the deployment. This project does not claim a specific retention
        period for provider-level logs; check the deployment’s operator if you need that detail.
      </p>

      <h2>Children</h2>
      <p>
        UniScope is intended for people researching higher education, generally older teenagers and adults. It does not
        knowingly collect personal data from children, and it does not require any personal details to use its core
        features.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes materially, the updated date will be shown here. The public coverage page records data
        build history separately.
      </p>

      <p className="cell-note">
        Contact for privacy questions or deletion requests: use the <Link to="/report">correction report form</Link>{' '}
        and select “Something else”, including any reference code you already have. Do not send passwords or tokens.
      </p>
      <p className="cell-note">Draft updated 2026-10-17.</p>
    </div>
  );
}
