# Data method, sources and verification

This document explains how a record enters UniScope, what each label means, and what the project deliberately does **not** claim. The generated [COVERAGE.md](COVERAGE.md) is the current snapshot; this page describes the method.

## 1. Source evaluation

| Source | License / access | Used for | Not used for |
| --- | --- | --- | --- |
| [Research Organization Registry (ROR)](https://ror.org/) data dump | CC0 1.0; quarterly releases; Zenodo record `10.5281/zenodo.6347574` | Discovery identity: names and local names, country/city/coordinates, website domains, ROR id, active status, `education` type | University status, accreditation, programmes, tuition, deadlines, rankings |
| [Hipo university-domains-list](https://github.com/Hipo/university-domains-list) | MIT; community-maintained JSON | Additional university listings and official domains, mainly for discovery | Proof that an institution is a university, or that any programme/fee exists |
| Office for Students (OfS) register | Public regulator page; cited, not bulk-copied | Recognition example: Oxford's approved (fee cap) registration | Automatic accreditation of every course or campus |
| Official university pages | Public pages; cited with URL and read date; short factual extracts only | Programmes, fees, deadlines, admissions, scholarships, recognition | Bulk scraping, bypassing access controls, or claims beyond what the page states |

No source is described as “live”, “verified complete” or “current”. A directory snapshot has a release date; a fact has a read date. Neither proves that the page is unchanged today.

### Why only three source-checked profiles

Taking a directory row and inventing tuition or programmes would violate the project's core rule. Verified facts require a person to open the official page, identify the degree level, intake/academic year, applicant category and fee basis, then write a reviewable research file. The 2026-10-17 build contains three such profiles as a working demonstration of that pipeline:

- **University of Oxford** — 2027-entry undergraduate course-fee range, home fee, two programmes, UCAS deadline, entry requirements, two scholarships, OfS registration.
- **University of Toronto (Scarborough campus)** — Bachelor of Computer Science, Fall 2027 application/document deadlines for domestic and international applicants, 2026–27 fee estimates for three applicant categories, campus-specific notes.
- **Westminster International University in Tashkent (Uzbekistan)** — BSc (Hons) in Computer Science with 2026/27 entry requirements, domestic and international undergraduate tuition in UZS, the 2026/27 programme-level accreditation statement, and the 17 August 2026 undergraduate deadline, each labelled with its academic year, applicant category and source.

The app states this ratio on the home, search, profile and coverage pages rather than hiding it.

## 2. From directory rows to records

1. **Fetch** ROR's JSON dump (ZIP) and Hipo's JSON. Downloads are size-capped, follow a limited number of redirects, use the system CA store and are cached. Conditional reuse avoids repeat downloads. TLS verification is never disabled.
2. **Filter ROR** to `status: active` and `types` containing `education`.
3. **Normalise** names, domains (lowercase, strip `www`, scheme, port, path), country codes and coordinates.
4. **Deduplicate** in this order:
   - same canonical domain **and** same country code;
   - otherwise same folded primary name **and** same country code, but only when the name match is unique;
   - otherwise a listing may join a ROR record through the website host only when that host is not generic (for example not `sites.google.com` or a social network), exactly one candidate in the same country shares the host, and the two names are similar. Website hosts are frequently shared by unrelated organisations, faculties and branches, so the host is a supporting signal — never a match on its own.
   - Hipo-only records receive a deterministic id derived from name, country and first domain, so repeated ingests are stable.
   - Same-named institutions in different countries are kept separate. Campuses are not invented; a campus is added only from an official page that names it.
5. **Assign scope**:
   - *university scope*: Hipo listing (excluding names that clearly indicate a seminary, Bible college, film/language/driving/beauty school or pre-university school) **or** a multilingual university-name heuristic for ROR records.
   - *education scope*: other ROR `education` organisations. These are shown only when the user expands scope, and are labelled as broader education records.
   - Neither label is an official classification.
6. **Infer a display type** (`university`, `technical-university`, `college`, `institute`, `academy`, `not-classified`) from the directory name. This is explicitly described in the UI as name-based, not verified.
7. **Apply reviewed research files** (`data/research/*.json`). A research file must match exactly one directory record by ROR id, canonical domain or folded name + country. It may only assert facts for which it defines a source key.
8. **Validate** the complete dataset with Zod, including duplicate ids, programme/fee/deadline references, future read dates, source existence and directory-only fact prohibitions.
9. **Write** the dataset atomically as gzip, plus coverage and history artifacts. A failed validation aborts the build; no partial dataset is served.

## 3. Fact-level rules

- **Institution vs campus vs programme.** A fee or deadline attached to an institution-wide list has `programId: null`. A programme fact must reference the enclosing programme and, where relevant, name the campus. The UI repeats the scope on every row.
- **Academic year and intake.** Fees require `academicYear`. Deadlines require `intake` and `academicYear`. These are copied from the source; they are not inferred from the current date.
- **Applicant category.** `international`, `domestic`, `home`, `eu-eea`, `in-state`, `out-of-state`, `all` or `other`. A domestic-only fee is never presented as an international fee, and comparison requires the selected category to match.
- **Currency and basis.** Original ISO 4217 currency, exact or published range, unit (`per-year`, `per-semester`, `per-term`, `per-credit`, `total-program`, `per-month`) and coverage. No exchange rates are bundled; cross-currency comparison is refused.
- **Recognition.** A named body, scope, status and source. “Listed on a register” is not written as “accredited”. Absence of a recognition entry is not evidence of non-recognition.
- **Missing information.** Rendered as “Not available”, “Needs verification”, “Programme data not available” or “No source-checked fee”. Missing values never become zero, false or an average. Filters that exclude unknown records show how many were withheld.
- **Dates.** `retrievedAt` is when the page was read. `publishedAt`/`effectiveAt` are set only when the page states them. Stale-source warnings appear after 180 days and one year.
- **Rankings.** None are ingested. Comparison uses only the dimensions with comparable sourced facts and says when no reliable overall recommendation is possible.

## 4. Updates and review

- `npm run ingest` is the only way to write a dataset. It is deterministic for the same inputs and research files.
- The ROR/Hipo cache avoids unnecessary downloads; `--refresh` forces a fetch.
- GitHub Actions runs a monthly scheduled ingest (and a manual dispatch) that commits the regenerated gzip, coverage, history and coverage doc only when the content changed. The workflow never invents research files.
- Correction reports are appended to a JSONL queue. With `ADMIN_TOKEN` set, `/admin` lists them and allows status changes (`new`, `reviewing`, `resolved`, `rejected`). Reports do not automatically modify the dataset; a human must update a research file, re-run ingest and review the diff.
- The public coverage page shows the last 50 update entries with source releases and totals.

## 5. What is explicitly not claimed

- Completeness of world universities, programmes, fees, scholarships or deadlines.
- That directory inclusion implies university status, accreditation, degree-awarding authority or recognition.
- That a page read on a date is still current.
- That a fee is the total cost of attendance, that a listed deadline applies to every applicant, or that a scholarship is guaranteed.
- That the app provides legal, immigration, credential-recognition or admission advice.
- That the subject taxonomy or institution type is official.
- That the legal pages are approved by a lawyer or that the service is compliant with every jurisdiction.

## 6. Reproducing the current snapshot

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run ingest -- --offline
npm run validate:data
npm run coverage:doc
```

`--offline` reuses `data/build/.cache/` (ROR v2.14-2026-10-06 and the Hipo snapshot). Without the cache, run without `--offline` and allow network access.
