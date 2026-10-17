import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/hooks';
import { Notice } from '../components/States';

export function TermsPage() {
  usePageTitle('Terms of use');
  return (
    <div className="container page page--narrow prose">
      <header className="page-head">
        <p className="eyebrow">Draft · not legal advice</p>
        <h1>Terms of use</h1>
        <p className="page-sub">
          UniScope is a free research aid. It does not make decisions for you, and it cannot guarantee that a linked
          university page is current or that any application will succeed.
        </p>
      </header>

      <Notice tone="warning" title="Draft terms">
        <p>
          These terms are a draft for an early-stage service. They are not a claim of legal approval, regulatory
          compliance or fitness for any particular jurisdiction. If you need legal certainty, obtain professional advice.
        </p>
      </Notice>

      <h2>1. What UniScope provides</h2>
      <p>
        UniScope publishes a directory of education organizations and, for a limited set of institutions, source-checked
        facts about programmes, fees, deadlines, funding and recognition. It also provides comparison tools that operate
        on those facts and on your stated preferences.
      </p>
      <p>
        The service is provided “as is” and “as available”. We aim for accuracy and traceability, not completeness. We do
        not warrant that the service will be uninterrupted, error-free, or that any data is current at the moment you
        read it.
      </p>

      <h2>2. Not advice</h2>
      <p>
        Nothing on UniScope is admissions, immigration, visa, scholarship, financial, legal or career advice. A
        comparison outcome is not a prediction or a recommendation that you will be admitted, funded or recognised. You
        are responsible for checking official university, government and accreditation sources before applying,
        paying, travelling or making any decision with financial consequences.
      </p>

      <h2>3. Third-party information</h2>
      <p>
        Institution names, directory data, official pages and linked documents belong to their respective owners.
        Directory sources are used under their stated licences; official pages are linked rather than reproduced. A
        link or directory entry is not an endorsement, accreditation claim or partnership. UniScope is independent and
        is not affiliated with any university, ministry, accreditation body, ROR or Hipo.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not use the service to harass institutions or individuals, or to submit knowingly false reports.</li>
        <li>Do not attempt to bypass rate limits, authentication or access controls, or to scrape at a rate that harms the service.</li>
        <li>Do not upload or submit personal data about other people without a lawful basis.</li>
        <li>Do not misrepresent UniScope data as official university or government information.</li>
        <li>Do not use the service as the sole basis for a high-stakes decision.</li>
      </ul>

      <h2>5. Accounts and admin access</h2>
      <p>
        Ordinary use requires no account. Admin review is restricted to the deployment operator and is protected by a
        server-side token. Attempting to access it without authorization is prohibited.
      </p>

      <h2>6. Your content</h2>
      <p>
        You keep ownership of the text you submit in a correction report. By submitting it, you give the operator
        permission to store and review it for the purpose of improving the data and, where appropriate, to contact you
        at the email you provided. Do not submit confidential information.
      </p>

      <h2>7. Availability and costs</h2>
      <p>
        The service is free to users. Hosting, data and maintenance may depend on free tiers or volunteer effort; no
        perpetual zero-cost or unlimited-scale guarantee is made. Features may change or be withdrawn. If a future
        feature introduces a paid dependency, the operator should explain it before enabling it.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, the operator is not liable for indirect, incidental, special
        or consequential losses, or for decisions made in reliance on the service, including application fees, tuition,
        travel, visa or relocation costs. Nothing in these terms excludes liability that cannot lawfully be excluded.
      </p>

      <h2>9. Changes</h2>
      <p>
        These terms may be updated as the service develops. The version date will be shown below. Continued use after a
        change means you accept the updated draft terms; if you do not, stop using the service.
      </p>

      <h2>10. Governing law</h2>
      <p>
        This draft does not select a governing jurisdiction. That is a decision for the operator and should be reviewed
        before a production launch. It is stated here so the gap is visible rather than implied.
      </p>

      <p className="cell-note">
        Questions about these terms can be sent through the <Link to="/report">correction report form</Link>. Draft
        updated 2026-10-17. See also the <Link to="/privacy">privacy notice</Link>.
      </p>
    </div>
  );
}
