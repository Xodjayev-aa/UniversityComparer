import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/hooks';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="container page page--narrow">
      <header className="page-head">
        <p className="eyebrow">404</p>
        <h1>That page does not exist</h1>
        <p className="page-sub">
          The link may be old, mistyped, or point to a profile that is not in this data release. UniScope never invents
          a replacement page.
        </p>
      </header>
      <ul className="link-list link-list--large">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/search">Search universities</Link></li>
        <li><Link to="/countries">Browse by country</Link></li>
        <li><Link to="/subjects">Browse by subject</Link></li>
        <li><Link to="/shortlist">Your shortlist</Link></li>
        <li><Link to="/coverage">Coverage and sources</Link></li>
      </ul>
    </div>
  );
}
