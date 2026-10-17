# UniScope

University discovery and comparison with **per-fact provenance** — an installable web app (PWA) that shows what is known, when it was read, and what is still missing. Free to use; no account and no payment.

> **Status: v0.1 development release.** It is not complete, not a world register and not production-ready. Only a small number of profiles have source-checked programme, fee, deadline or recognition facts. Everything else is a clearly labelled directory record.

## What works

- Search by name, alternate/local/former name, city, country or region, with Unicode-aware matching (for example `montreal` ↔ `Montréal`, Arabic and CJK names preserved).
- Browse countries and subject areas; filters for degree level, teaching language, study mode and source-checked fee/profile data.
- University profiles with separate institution, campus and programme context; per-fact source, read date, applicant category, academic year and intake.
- Compare 2–4 institutions with presets, hard requirements and visible trade-offs. Missing data is never treated as cheap, poor or zero.
- Local shortlist with private notes, CSV/Markdown export (notes excluded by default), share link for comparison.
- Installable Android PWA with regular and maskable icons; API responses are **not** cached for offline use. Only explicitly saved profiles are viewable offline, with their saved date.
- Correction-report form; optional admin review queue protected by an `ADMIN_TOKEN` (disabled unless configured).
- Public coverage page generated from the same dataset, listing sources, counts, gaps and update history.

Current build (`npm run ingest`, 2026-10-17): **32,210 directory records** in 224 countries, of which **24,825 are in the university scope** and 7,385 are broader education records. **3 profiles are source-checked** (University of Oxford; University of Toronto Scarborough's Computer Science programme; Westminster International University in Tashkent), contributing 42 sourced facts, 4 programmes, 7 fee facts, 4 deadlines and 2 recognition facts. This is intentionally visible in the app and in [docs/COVERAGE.md](docs/COVERAGE.md). Directory breadth is not verification depth.

## Quick start

```bash
npm install --legacy-peer-deps

# Build the dataset (network access; reuses ./data/build/.cache when present)
npm run ingest

# Terminal 1: API on :8787 ; Terminal 2: Vite on :5173 with /api proxy
npm run dev

# Production-style: build the client, then serve API + static app
npm run build
npm start            # PORT=3000 by default in production
```

Open `http://localhost:5173` in development. For a phone on the same network, use the machine's LAN address; Vite binds to `0.0.0.0`.

### Environment

Copy [.env.example](.env.example) to your shell configuration. The server does **not** load `.env` files itself.

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | Listen address (default `8787` dev, `3000` production; host `0.0.0.0`). |
| `UNISCOPE_DATA_DIR` | Directory containing `institutions.json.gz` and `coverage.json` (default `./data/build`). |
| `UNISCOPE_VALIDATE_DATA=1` | Validate the whole dataset against the Zod schema at startup. |
| `REPORT_STORE_DIR` | Correction-report JSONL directory (default `./data/runtime`). Use a persistent volume in production. |
| `ADMIN_TOKEN` | Enables `/admin` review. Must be at least 24 characters; otherwise admin routes return 503. |
| `ADMIN_SESSION_SECRET` | Optional HMAC key for admin cookies; derived from `ADMIN_TOKEN` when absent. |
| `TRUST_PROXY=1` | Trust the first proxy hop for client IPs. Only behind a proxy that overwrites `X-Forwarded-For`. |

No secrets are read by the browser and no AI or paid API is used in this release. There is no AI assistant at all; core search and comparison work without it.

## Data model and honesty rules

Two evidence levels are kept separate in the type system and in the UI:

| Level | What it means | What may be shown |
| --- | --- | --- |
| `directory-only` | Identity/geography came from an open directory. No official page was read. | Name, country, city, website, directory basis. **No** programmes, fees, deadlines, scholarships or recognition. |
| `source-checked` | A person read the linked official page on the recorded date. | Only the facts written into a reviewed research file, each with URL, read date, year/intake, applicant category and scope. |

Additional rules enforced by schema and tests:

- Missing data is **absent** or `null`, never `0`, `free`, `unknown fee` or an inferred value. The UI prints “Not available”, “Needs verification” or “Programme data not available”.
- A fee without an academic year is rejected. Institution-wide fees/deadlines must state a degree level; programme fees/deadlines must reference their enclosing programme.
- Currency is never converted in this release. Fees keep their original ISO currency and unit (year/semester/term/credit/whole programme) and coverage (tuition-only, including fees, fees separate, unclear).
- “Read on” is not “updated on”. `retrievedAt` is the date a person opened the page; `publishedAt`/`effectiveAt` appear only when the page states them.
- Directory inclusion is not accreditation, university status or degree-awarding authority. Recognition is shown only with a named body and a source.
- No rankings are ingested, mixed or invented. No quality, personal-fit or admission-chance score exists. When comparable evidence is insufficient, comparison says so explicitly.
- Demonstration/example records are never mixed into production search. The test fixtures live under `tests/` and are not loaded by the server.

See [docs/DATA-METHOD.md](docs/DATA-METHOD.md) for source evaluation, deduplication and updating, and [data/research/README.md](data/research/README.md) for adding a verified profile.

## Ingestion

```bash
npm run ingest                 # fetch/cache directory sources, apply research files, validate, write artifacts
npm run ingest -- --offline    # use the cached ROR zip and Hipo JSON only
npm run ingest -- --refresh    # ignore cache and fetch again
npm run ingest -- --no-history # do not append a history entry
npm run validate:data          # validate the built dataset and print counts
npm run coverage:doc           # regenerate docs/COVERAGE.md from coverage.json
```

Outputs (committed so the app can run without network access):

- `data/build/institutions.json.gz` — schema-validated dataset (~2.9 MB gzip; the uncompressed JSON is ~56 MB).
- `data/build/coverage.json` — counts, country coverage, gap statements, last 50 updates.
- `data/build/history.json` — same update history.
- `docs/COVERAGE.md` — human-readable coverage and source acknowledgements.

Raw inputs are cached in `data/build/.cache/` (git-ignored). Sources are fetched with conditional cache reuse, a bounded download size, system CA validation and **no TLS-verification bypass**. The ROR data dump and Hipo repository are read under their respective licenses (CC0 1.0 and MIT); see [docs/COVERAGE.md](docs/COVERAGE.md).

In sandboxes with a private CA, Node may need `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`. Never disable certificate verification.

## Tests

```bash
npm run typecheck
npm test                 # mocked unit + API tests; no outbound network
npm run test:live        # real ROR / Oxford / Hipo reachability checks
```

The default suite covers Unicode search, aliases and former names, scope/filters, directory dedupe and campus separation, comparison maths with missing/currency/year mismatches, fee units and applicant categories, deadline and staleness labels, shortlist/export injection and note privacy, accessible component labels, PWA manifest/icon configuration, report validation and admin guards. `npm run test:live` is deliberately separate and rate-limited; it is not a substitute for human review of official pages.

## Verification status

What was executed, what was read from official pages, and what remains unverified is recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md). It deliberately does not describe the project as complete or production-ready.

## Privacy and security

- Search and comparison are public; no account or email is required.
- Shortlists and private notes live in `localStorage` (`uniscope.shortlist.v1`) on the device and are never sent to the server unless the user exports them.
- Correction reports are the only user-submitted data and are stored server-side. Email is optional; do not include sensitive personal data. See `/privacy`.
- Security headers (helmet), a production CSP, JSON body limits, rate limits, same-origin checks for admin actions, honeypot field and output escaping are implemented. Report imports/display are validated; CSV exports neutralise spreadsheet formula prefixes.
- Admin review is disabled by default, is `noindex`, and uses an HMAC-signed, HttpOnly, SameSite=Lax cookie.

## Hosting and cost

Nothing paid is configured. This release has no database, email service or AI provider. A static host plus a small Node service is enough; the dataset is ~2.9 MB gzipped and the server keeps it in memory (~200–350 MB RSS with the current build).

Free-tier examples (limits change; verify before deploying): Cloudflare Pages static hosting and a small Workers/Functions tier, or Vercel/Netlify hobby tiers, plus free GitHub Actions minutes for the scheduled ingest. Cloudflare Pages has a **25 MB per-file** limit, which is why the dataset ships gzipped rather than as 56 MB JSON. The report queue is a JSONL file and is **not durable** on ephemeral filesystems; production use needs a persistent volume or a database (a new cost/decision).

## Limitations and next work

- Verified coverage is very thin: 3 institutions. Adding profiles requires reading official pages and writing research files; it is not automated by scraping.
- City is missing for 2,036 records and a domain for 10,777 because those sources do not provide them. Nothing is inferred.
- Directory coverage is not complete and is not an official register. Hipo is community-maintained; ROR includes many organisations that are not universities.
- No currency conversion, no rankings, no admission/scholarship/visa predictions, no live page monitoring.
- The subject taxonomy is UniScope's own grouping, not an official or publisher taxonomy.
- Mobile/PWA behaviour is verified by configuration and component tests; a real Android install test on a device is still recommended.
- Legal pages are drafts and are not legal advice.

## License and acknowledgements

Code: MIT. Directory data: ROR (CC0 1.0) and Hipo university-domains-list (MIT). Official-page facts remain subject to the terms of the pages they came from; only short factual extracts and links are stored. See `/about`, `/privacy`, `/terms` and [docs/COVERAGE.md](docs/COVERAGE.md).
