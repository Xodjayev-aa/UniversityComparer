# Verification status

Last updated: **2026-10-17** (build with 32,210 records and the WIUT profile). This file records what was actually executed, what was checked by reading a page, and what remains unverified. It is not a quality score.

## Automated checks run in this workspace

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (strict, whole repo) | `npx tsc --noEmit` | Passed, no diagnostics |
| Unit + API tests (mocked, no outbound network) | `npm test` | **92 passed / 92**, 12 files |
| Dataset validation (schema, duplicate ids, references, future read dates) | `npm run validate:data` | Passed: 32,210 records; 3 source-checked; 4 programmes; 7 fee facts |
| Production client build + PWA generation | `npm run build` | Passed: 26 precache entries; `manifest.webmanifest` and `sw.js` generated |
| Production server smoke test | `PORT=3123 NODE_ENV=production npx tsx server/index.ts` | `/api/health` 200 (`32,210` records); `/` 200 `text/html`; `/manifest.webmanifest` 200 `application/manifest+json`; `/sw.js` 200 `text/javascript`; `/icons/icon-512.png` 200 `image/png`; `/robots.txt` 200 |
| Development server + API proxy | `npm run dev` on `:5173`, API `:8787` | `/api/health`, `/api/meta`, `/api/search` returned live dataset data through the Vite proxy |

### What the mocked suite covers

- Unicode folding and search: accents, Arabic diacritics, CJK/Hangul, aliases, local and former names.
- Scope handling: university vs broader education records; withheld counts and notices for unknown programme/fee/language data.
- Directory ingestion: domain/name deduplication, same-name different-country separation, non-education and inactive filtering, seminary/film-school de-scoping.
- Website-host merging: a shared host merges only when it is not generic, exactly one candidate in the country shares it and the names are similar; shared hosts alone never merge unrelated organisations.
- Comparison: fee selection by applicant category and degree, refusal to rank across currencies, academic years or differing coverage, hard requirements, missing programme catalogues treated as unknown, explicit “no reliable recommendation”.
- Fees and dates: original currency formatting, ranges, units and coverage, applicant and university-wide vs programme deadline context, passed/upcoming/deadline staleness labels, source age warnings.
- Shortlist and exports: local-only storage, corrupted-storage tolerance, CSV quoting and formula-injection neutralisation, private notes excluded by default.
- UI: accessible search label and navigation, honest directory-only card labels, page-level rendering for home/search/profile/compare/countries/subjects/coverage/shortlist/about/privacy/terms/install, App shell and 404, API network and 404 error messages.
- Server: health/meta/coverage/facets/search/institution/compare, validation errors, report storage, honeypot, admin disabled/guarded/cross-origin, missing dataset 503.
- PWA: manifest fields, icon sizes (parsed with `sharp`), API `NetworkOnly` rule, responsive viewport without zoom blocking.

## Human source checks

The following official pages were opened and read on **2026-10-17**; the extracted facts and their context are in `data/research/*.json`.

| Page | Facts taken |
| --- | --- |
| `ox.ac.uk/admissions/undergraduate/fees-and-funding/course-fees` | 2027/28 home fee cap (£10,050); overseas range £39,620–£66,580; scope of course fee (excludes living costs); annual increases warning |
| `ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science` | BA/MCompSci, 3 or 4 years, A*AA entry, UCAS G400, 15 October 2026 deadline, full-time |
| `ox.ac.uk/admissions/undergraduate/courses/course-listing/philosophy-politics-and-economics` | BA, 3 years, AAA, UCAS L0V0, 15 October 2026 deadline |
| `ox.ac.uk/admissions/undergraduate/applying` (and admissions timeline search results) | Oxford's 6pm UK-time 15 October 2026 UCAS deadline for 2027 entry |
| `ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-bursaries-and-scholarships` | Crankstart Scholarship; Reach Oxford Scholarship |
| `ox.ac.uk/about/how-we-are-run/governance-finance/ofs` | OfS approved (fee cap) registration since July 2018 |
| `utsc.utoronto.ca/admissions/programs/computer-science` | BCS, Fall 2027, 4 years, co-op, OUAC TXC, requirements, domestic/international deadlines |
| `utsc.utoronto.ca/admissions/tuition-and-fees` | 2026–27 first-year and upper-year fees for three applicant categories; CAD 2,286 incidental fees; 2027–28 fees pending spring 2027 |
| `wiut.uz/bsc-hons-in-computer-science` | BSc (Hons) Computer Science, 3 years full-time, September start, NQAAE programme accreditation and University of Westminster validation, 2026/27 entry requirements (Foundation/A level/IB alternatives; IELTS 6.5 with 6.0 writing; TOEFL iBT 85 with 22 writing; Maths test/SAT 570; age 18), domestic 38,820,000 UZS/yr and international 54,600,000 UZS/yr |
| `wiut.uz/tuition-fees` and `wiut.uz/tuition-fees-international` | 2026/27 undergraduate tuition in UZS for domestic and international applicants, per academic year; USD approximations on the international page use a rate dated 7 April 2026 and were **not** stored or converted by UniScope |
| `wiut.uz/direct-entry-transfer` | Undergraduate application deadline 17 August 2026 for 2026/27 entry (already passed); documents deadline “to be announced”; decision typically 14–20 days |

Search-result snippets were used only to locate these pages or confirm the same deadline wording; they are **not** stored as sources. The stored source for every fact is the official page URL in each research file.

## Installability audit (PWA)

Checked against the built `dist/` output and the production server on **2026-10-17**. This is a configuration audit, not a device install.

| Installability requirement | Evidence |
| --- | --- |
| Served over HTTPS | The sandbox preview is an HTTPS URL. `localhost` is the browser exception. A plain-HTTP deployment would not be installable. |
| Manifest | `/manifest.webmanifest` served as `application/manifest+json`; `name`, `short_name`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `theme_color`, `background_color`, `lang`, `dir`, `id`, three shortcuts. |
| Icons | `icon-192.png` and `icon-512.png` (`purpose: any`) plus `maskable-192.png` and `maskable-512.png` (`purpose: maskable`). Dimensions parsed from the PNG headers; the maskable artwork was also opened and checked for a safe zone. `apple-touch-icon.png` is 180×180. |
| Service worker | `registerSW.js` registers `/sw.js` with scope `/` after load. `sw.js` precaches 26 entries (app shell, CSS, JS, icons, manifest, `robots.txt`) and uses a navigation route to `/index.html` with `/api/` denied, so deep links open offline. |
| API caching | `/api/` GET requests use Workbox `NetworkOnly`; no API response is precached. Offline users see saved snapshots, not stale “fresh” data. |
| Offline labelling | The shell shows an offline banner; saved profiles show their save date; the shortlist warns that saved information may be out of date; search and fresh profiles require a connection. |
| Not verified | No real Android/Chrome installation, no Lighthouse run and no beforeinstallprompt event were exercised here (the sandbox has no browser). **No APK or AAB exists**, and there is no Play Store listing. Packaging a Trusted Web Activity would require Bubblewrap or PWABuilder plus signing keys, and Play distribution would require review. |

## Directory dedupe spot check (Uzbekistan)

While checking Uzbek coverage, `Turin Polytechnic University` appeared twice: once from ROR (website `polito.uz`, no domain list) and once from Hipo as `Turin Polytechnic University In Tashkent`. The two listings share a website host and describe the same institution. The merge rule described above now joins them, and the record is marked as also present in Hipo. The same check found 30 remaining website-host pairs that are mostly legitimate translations or renames; several obviously wrong pairs from an earlier, ungated host-only attempt (for example two unrelated institutions sharing a faculty site) are no longer merged.

`Webster University in Tashkent` is **not** in either directory source and is therefore not listed. It was confirmed to exist from its official site (`ciep.webster.uz`), but adding it would require a deliberate standalone record with city/language fields, which this build does not generate. It is recorded here as a known gap rather than inserted without those fields.

## What is *not* verified

- **Only 3 institutions have source-checked facts** out of 24,825 university-scope directory records. The other records are discovery entries. This is a demonstration of the evidence pipeline, not broad verified coverage.
- **No Android device install was performed.** PWA correctness is verified by manifest/icon configuration, build output, service-worker precache contents and component tests. Installation, standalone display, maskable icon cropping and offline reopening should be confirmed on a real device.
- **No screen-reader or automated axe audit was run.** Keyboard structure, labels, roles and focus handling are implemented and covered by component tests, but no formal WCAG conformance is claimed.
- **No cross-browser testing** beyond jsdom. Safari/iOS behaviour, especially install prompts and `Intl` formatting, is not verified.
- **No load or penetration test.** Rate limits, CSP and header configuration are implemented but not stress-tested.
- **No legal review.** `/privacy` and `/terms` are drafts dated 2026-10-17 and are not legal advice. Jurisdiction-specific obligations (GDPR, UK GDPR, UZ law, etc.) were not assessed.
- **No currency conversion** exists, so fees in different currencies cannot be compared. The app refuses to rank them.
- **No ranking data** is ingested, so no ranking claims can be checked or displayed.
- **The correction-report queue** is a local JSONL file. It is not durable on ephemeral hosting and was not tested against concurrent writers at scale.
- **Scheduled ingestion** is defined in `.github/workflows/ingest.yml` but has not been executed by GitHub Actions from this workspace.
- **Live-source tests** (`npm run test:live`) were not executed here because this sandbox could not complete outbound TLS to ROR/Hipo at test time. They are kept separate from the mocked suite and should be run in CI or locally with normal network access.

## Known functional limitations

- 2,036 records have no city and 10,777 have no domain because the directory sources do not provide them; nothing is inferred.
- Hipo listings are community-maintained. Some are not universities; the app labels them and de-scopes names that clearly indicate seminaries, film/language schools or pre-university schools, but the classification is imperfect.
- ROR “education” includes non-university organisations. The university scope is a name heuristic plus Hipo; it can be wrong in both directions.
- The subject taxonomy is UniScope's own grouping.
- Programme lists are selective samples of official pages, not complete catalogues. WIUT lists one reviewed programme; its other programmes were not checked.
- Comparison uses only the dimensions with comparable sourced facts; it may frequently say “no reliable recommendation”.
- The dataset is ~56 MB JSON (2.9 MB gzip) and is loaded into memory by the API. This is acceptable for a small deployment but not a large-scale multi-tenant service.

## How to re-run the checks

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm test
npm run validate:data
npm run build
npm run test:live   # requires normal outbound network access
```

Record the date and result of any new verification here rather than describing the project as “complete” or “production-ready”.
