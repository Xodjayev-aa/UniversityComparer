import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/hooks';
import { Notice } from '../components/States';

export function AboutPage() {
  usePageTitle('About UniScope');
  return (
    <div className="container page page--narrow">
      <header className="page-head">
        <p className="eyebrow">What this is — and what it refuses to do</p>
        <h1>About UniScope</h1>
        <p className="page-sub">
          UniScope is a free, account-free way to discover universities and compare the facts we can actually trace to
          a source. It is built to be useful without pretending to know more than it does.
        </p>
      </header>

      <section aria-labelledby="purpose-title">
        <h2 id="purpose-title">Why it exists</h2>
        <p>
          University search is full of confident numbers with no provenance: “tuition from €0”, “ranked #1”, “acceptance
          rate 12%”. Those numbers often come from marketing pages, old scrapes or unstated years. UniScope separates
          three things that are usually mixed together: <strong>directory discovery</strong> (does this institution
          exist in an open directory?), <strong>sourced facts</strong> (what did an official page say, when did we read
          it, and for which year and applicant?) and <strong>comparison logic</strong> (what follows from those facts,
          with gaps left visible).
        </p>
      </section>

      <section id="verification" aria-labelledby="levels-title">
        <h2 id="levels-title">Two levels of evidence, never blended</h2>
        <div className="level-grid">
          <article className="level-card">
            <h3>Directory record</h3>
            <p>
              A name, country, sometimes a city and website, from ROR (the Research Organization Registry) or the
              community-maintained Hipo university directory. These are discovery aids, not official registers.
            </p>
            <ul>
              <li>No programme, fee, deadline, scholarship or accreditation claims.</li>
              <li>No “verified” badge.</li>
              <li>Missing fields are shown as “Not available”, never as zero.</li>
            </ul>
          </article>
          <article className="level-card">
            <h3>Source-checked profile</h3>
            <p>
              Facts a person read on an official university or authority page, stored with the page URL, the date we
              read it, and — where the page states it — the publication/effective date, academic year, intake and
              applicant category.
            </p>
            <ul>
              <li>Every fact links to its source and read date.</li>
              <li>“Read on” is not a claim that the page is unchanged today.</li>
              <li>Programme lists are selective, not complete catalogues.</li>
            </ul>
          </article>
        </div>
      </section>

      <section aria-labelledby="never-title">
        <h2 id="never-title">What UniScope does not do</h2>
        <ul className="gap-list gap-list--coverage">
          <li>It does not claim to cover every university, programme or country. Coverage is counted and published.</li>
          <li>It does not invent tuition, fees, deadlines, scholarships, rankings or admission requirements.</li>
          <li>It does not treat directory inclusion as accreditation or as proof of degree-granting status.</li>
          <li>It does not convert currencies without a dated, cited exchange-rate source; this release keeps original currencies.</li>
          <li>It does not produce a single “best university” score, quality score or personal-fit score.</li>
          <li>It does not predict admission, scholarship, visa or credential-recognition outcomes.</li>
          <li>It does not call data “live” or “verified” when it is a saved snapshot from a dated read.</li>
          <li>It does not train an AI on your shortlist, sell data or require an account.</li>
        </ul>
      </section>

      <section aria-labelledby="compare-title">
        <h2 id="compare-title">How comparison works</h2>
        <p>
          Comparison is preference-aware but evidence-bound. You choose a priority (lower cost, subject fit, location
          &amp; language, or balanced) plus hard requirements. UniScope only compares fees when currency, academic year,
          fee unit, coverage and applicant category are the same; otherwise the fee is left out, and that omission is
          stated. It never ranks an institution lower because a fact is missing. When less than two options have
          comparable evidence, it says no reliable recommendation can be made.
        </p>
        <p>
          Read more in the <Link to="/coverage">coverage and sources</Link> page, or open a{' '}
          <Link to="/compare">comparison</Link>.
        </p>
      </section>

      <section aria-labelledby="sources-title">
        <h2 id="sources-title">Sources and licences</h2>
        <p>
          The directory layer currently uses <strong>ROR</strong> (Research Organization Registry, CC0 data) and the{' '}
          <strong>Hipo university-domains-list</strong> (MIT licence). Each source’s version, retrieval date, licence
          and limitations are listed on the coverage page. Directory data is not relicensed by UniScope. Official
          university pages are linked, quoted in short factual form, and never mirrored in full.
        </p>
        <p>
          UniScope’s own code is open source. The name “UniScope” and the logo are original to this project. Source
          acknowledgements do not imply endorsement by ROR, Hipo or any university.
        </p>
        <Link className="text-link" to="/coverage">See the full source register →</Link>
      </section>

      <section aria-labelledby="ai-title">
        <h2 id="ai-title">AI: none in this release</h2>
        <p>
          UniScope does not use an AI assistant in this build. If one is added, it must be optional, cite the same stored
          evidence, state uncertainty, never mark its own output as verified, and must not be required for search or
          comparison. No third-party AI service is sent your shortlist or notes.
        </p>
      </section>

      <Notice tone="info" title="Found a mistake?">
        <p>
          Please <Link to="/report">report it</Link> with the official page you are looking at. Reports enter a review
          queue; a correction is made only when the source supports it. This is a small project, so no response time is
          promised.
        </p>
      </Notice>

      <p className="cell-note">
        UniScope is an independent project. It is not affiliated with, endorsed by, or an official representative of
        any university, ministry, accreditation body, ROR or Hipo. Nothing here is legal, immigration, financial or
        admissions advice.
      </p>
    </div>
  );
}
