# UniScope — product and data plan

Status: first-release plan, written before implementation. This document is deliberately
concrete about what is **not** known. Nothing in this repository should be read as a claim
of complete worldwide coverage, legal approval, or production readiness.

## 1. Worldwide directory strategy

UniScope needs two different things, and conflating them is the main honesty risk:

1. **Discovery breadth** — a way to find universities in many countries.
2. **Factual depth** — whether a specific university offers a specific programme, at what
   price, for which applicant, in which intake.

No open dataset provides (2) worldwide. We therefore built the product around an explicit
two-tier model:

| Tier | Contents | What it supports | What it does *not* prove |
| --- | --- | --- | --- |
| **Directory record** | Name, aliases, country, city (where the directory has one), website, directory IDs | Search, browsing, finding the official site | University status, accreditation, programmes, fees, deadlines |
| **Source-checked profile** | Facts read from official university/authority pages, each with URL + retrieval date + scope | Profile facts, programme lists, fee/deadline facts, comparison on those facts | That the fact is still current today, or that we cover every programme/fee |

The searchable directory is the union of:

- **ROR v2.14 (2026-10-06 snapshot)** — 30,174 active organisations with ROR type
  `education`. 223 country codes. Research Organization Registry, CC0 1.0.
- **Hipo `university-domains-list`** — 10,268 community-maintained university/college
  listings with domains, in 200 country codes. MIT licence. Snapshot retrieved
  2026-10-17.

Neither source is an accreditation authority or a national education ministry. Directory
inclusion is never displayed as proof of accreditation, university status, or current
offerings. ROR's `education` type is broad: it includes research institutes, some
hospitals and other education organisations. For that reason every record carries a
**listing basis** and a **scope**:

- `university` — listed in the Hipo university directory, or a curated profile, or an
  ROR education record whose name matches a transparent multilingual "university-like"
  name heuristic (universidad / université / universität / 大学 / جامعة / университет …
  with an exclusion list for hospitals, research institutes, consortia, etc.).
- `education` — a broader ROR education organisation that did not pass the heuristic.
  Hidden from default search; available through an explicit "Include broader education
  records" control, labelled "Education organisation — university status not checked".

The heuristic is a **discovery aid, not a classification authority**. Its rule and its
limitations are printed on the coverage page. Records are never presented as "verified
universities" merely because they passed it.

Deduplication:

- Canonical domain (lowercase, strip `www`, schemes, paths, trailing dots) is the primary
  merge key between ROR and Hipo.
- An ambiguous domain (one domain shared by more than one ROR organisation) is only merged
  when the normalised names also agree; otherwise records stay separate.
- Exact normalised name + country code is the fallback merge key when domains are absent.
- ROR aliases, local-language labels, acronyms and websites are preserved. Campuses /
  additional locations from ROR are preserved as **ROR-recorded locations**, not called
  campuses unless an official source confirms them. Former names are preserved when a
  source labels them as former; ROR's schema does not mark former names reliably, so we
  do not invent that label.
- No destructive fuzzy merge of similarly named universities (e.g. "University of
  Technology" variants) without domain or exact-name evidence.

## 2. Initial verifiable source set and licensing

| Source | Use | Licence / terms | Retrieved | Limitations |
| --- | --- | --- | --- | --- |
| [ROR data dump](https://ror.readme.io/docs/data-dump) v2.14 (2026-10-06) via [ror-community/ror-data](https://github.com/ror-community/ror-data) | Discovery: names, aliases, local scripts, country/city, website, domains, coords | **CC0 1.0** (confirmed on ror.org/about and ROR data-dump docs) | 2026-10-17 | Not a university or accreditation register; `education` type is broad; no programmes/fees |
| [Hipo university-domains-list](https://github.com/Hipo/university-domains-list) | Discovery: university/college listings, domains, country, state | **MIT** (LICENSE.txt in repo; copyright 2014–2025 Hipo) | 2026-10-17 | Community-maintained, not authoritative, not complete, includes non-university institutions |
| GeoNames place metadata carried inside ROR | City/coordinate display | ROR redistributes this data under CC0; GeoNames itself is CC BY 4.0 | 2026-10-17 | City may be the ROR location, not the main campus |
| Official university pages | Source-checked profile facts | Fact-level quotation + link; no bulk copying; robots/terms respected; manual retrieval only | Recorded per fact | Pages change; a page read today is not an "update" |
| National/regional recognition authorities | Accreditation/recognition claims | Only where explicitly fetched and cited | Recorded per fact | Not systematically checked; absence means "not checked" |

Deliberately **not** used:

- Commercial ranking tables (QS/THE/US News/Shanghai) — licensing and "quality" framing
  problems.
- Scraped admissions aggregators or scholarship databases with unclear terms.
- Wikidata live queries in this release (the build environment cannot reach it; the model
  is ready for a licensed/credited import later).
- Any source whose robots rules, rate limits or terms prohibit automated collection.
- Currency conversion APIs. No conversion is shown in this release; original currencies
  only. The FX model exists for a future licensed/attributed daily rate feed.

Ingestion is not a crawler. It downloads two published, openly licensed data dumps
(2 HTTP requests per refresh, conditional-friendly, with backoff) and merges hand-recorded
official-page facts. Scheduled refresh is weekly at most; source releases are quarterly
(ROR) and irregular (Hipo). No university website is crawled automatically.

## 3. Data model (summary)

- `Institution`: stable id, ROR id, domains, names (primary/official/aliases/local
  scripts/former), country, locations, website, kind, scope, listing basis, recognition,
  programmes, institution-level fee facts, scholarships, admissions links, verification
  level, sources.
- `Program`: degree level, subject area (controlled), language, study mode, duration,
  campus, admissions URL, per-programme fee facts and deadlines, source, status.
- `FeeFact`: amount `{kind: exact|range|estimate|not-available, min, max, currency}`,
  unit (year/semester/credit/programme), coverage (tuition only vs inclusive), academic
  year, intake, applicant category, degree level, study mode, campus/programme, source,
  status. Missing is `null` — never `0`.
- `DeadlineFact`: date (nullable) + original text, intake, academic year, applicant
  category, scope (university-wide vs programme-specific), source, status.
- `SourceRef`: URL, title, publisher, retrieved date, publication/effective date when
  available, licence where relevant.
- `Recognition`: body, body URL, scope, status, source, verification status. No body is
  inferred from directory inclusion.
- `Verification`: `official-source-checked` (a human read the linked page on the date),
  `directory-only`, `needs-verification`, `not-available`. The UI says
  **"Source-checked"**, not "verified" or "live".
- `Coverage`: generated counts, source versions, retrieval timestamps, known gaps and
  append-only build history.

All facts are scoped. A fee fact without academic year, applicant category and unit is
invalid and fails validation. A deadline without intake is invalid. A source-checked fact
without a URL and retrieval date is invalid.

## 4. First-release scope

Included:

- Responsive, accessible web app with installable Android PWA (manifest, maskable icons,
  app-shell service worker, offline shortlist snapshots with visible age).
- Search across directory records by name/alias/local script/country/city; browse
  countries and subjects; filters for degree level, teaching language, study mode,
  source-checked fee data, listing scope.
- University profiles that clearly separate directory facts from source-checked facts,
  show provenance per fact, distinguish university-wide vs programme-specific data, and
  use "Not available" / "Needs verification" instead of guesses.
- Compare 2–4 institutions with priority presets (lower cost, subject fit, location &
  language, balanced), hard requirements, visible trade-offs, and an explicit
  "not enough evidence" outcome. No universal quality score.
- Local shortlist with private notes; export/share excludes notes by default.
- Public coverage page with sources, counts, countries, gaps and update history.
- Report-an-error flow (rate-limited, server-side queue) with an optional token-protected
  review UI.
- Deterministic explanations generated from data (no AI). Core works fully without AI.
- Tests for search/Unicode, dedupe, comparison/missing data, fee units and categories,
  dates/staleness, sources/status, shortlist/export, PWA config, API failures and
  accessibility basics. Live-source checks are separate and opt-in.

Not in this release:

- Claims of "every university", global accreditation coverage, or current fees for every
  record.
- Currency conversion, rankings, AI chat, accounts/cloud sync, email notifications,
  payment, scholarship eligibility advice, visa advice.
- Automated crawling of university sites or scraping behind blocks/rate limits.
- Legal/compliance certification and guaranteed free-tier permanence.

Initial source-checked depth target: a small, explicitly counted set of institutions
across regions (not a token one-country sample), with at least one official-source fact
per profile and full provenance. The coverage page reports the exact number. Directory
breadth is reported separately and never used to imply depth.

## 5. Expected operating costs and limitations

First release is designed to run with **no paid service**:

- Static client + Node API on a free tier (e.g. Cloudflare Pages/Workers free allowance, or
  a free app host that sleeps). Dataset stays small enough for a single instance.
- Two open data dumps refreshed weekly by a scheduled job (GitHub Actions is free for
  public repositories within its included minutes; availability/allowances can change).
- No database, no email provider, no AI API, no FX API, no paid maps.
- Reports are stored on the API instance's disk. On ephemeral free hosts this is **not
  durable**; a production deployment needs a small persistent store or admin export.

Known cost/scale limits:

- Free tiers have request, CPU, RAM and build-minute caps and can change. We do not
  promise perpetual zero-cost operation at worldwide scale.
- A single Node process holds the directory in memory. That is fine for ~30–35k records,
  not for millions.
- Weekly refreshes can lag behind university pages; source-read dates are always shown.
- Manual source-checking does not scale with the directory. Most records will remain
  directory-only until reviewed.

Any future paid service (AI API, email, managed database, domain, FX feed) must be
proposed with expected cost and free-tier limits **and approved by the owner before it is
added**. No secret keys ever ship to the browser.

## 6. Honesty rules encoded in the product

- "Retrieved" and "updated" are separate concepts; the UI only shows "source read on".
- No zero, default or inferred value for missing fees/deadlines/accreditation.
- No ranking or score presented as university quality or a guarantee of outcomes.
- Missing data is excluded from cost ranking and reported as a gap, never treated as
  poor performance.
- Directory scope is visible on every search result and profile.
- Demonstration/fixture records are never merged into production data; tests use separate
  fixtures and the ingestion validator rejects records marked `demo`.
- Coverage page states what is covered, what is not, and when each source was retrieved.
