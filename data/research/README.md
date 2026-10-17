# Reviewed research files

Each `*.json` file adds source-checked facts to **one** directory record. Ingest fails if a file matches zero or multiple records, references an undefined source key, leaves a source unused, uses a future read date, or produces an invalid profile. Only add facts you have actually read on the linked page.

## Minimal shape

```json
{
  "schemaVersion": 1,
  "key": "example-university",
  "profileSource": "home",
  "match": {
    "rorId": "https://ror.org/012345678",
    "domains": ["example.edu"],
    "name": "Example University",
    "countryCode": "US"
  },
  "names": { "primary": "Example University", "official": "Example University" },
  "website": "https://example.edu/",
  "kind": "university",
  "languages": ["en"],
  "campuses": [],
  "recognition": [],
  "programs": [
    {
      "id": "ex-cs",
      "name": "Computer Science",
      "degreeLevel": "bachelor",
      "subjectArea": "computer-science",
      "language": "en",
      "studyModes": ["full-time"],
      "duration": "4 years",
      "source": "program",
      "tuition": [
        {
          "label": "International first-year tuition",
          "amount": { "kind": "exact", "min": 30000, "max": 30000, "currency": "USD" },
          "unit": "per-year",
          "coverage": "mandatory-fees-separate",
          "academicYear": "2026-27",
          "applicantCategory": "international",
          "studyMode": "full-time",
          "notes": "Year 2 and above may differ.",
          "source": "fees"
        }
      ],
      "deadlines": [
        {
          "date": "2027-01-15",
          "dateText": "15 January 2027",
          "intake": "Fall 2027",
          "academicYear": "2027-28",
          "applicantCategory": "international",
          "source": "program"
        }
      ]
    }
  ],
  "tuition": [],
  "scholarships": [],
  "admissions": { "requirements": [], "deadlines": [], "links": [] },
  "dataNotes": [],
  "sources": {
    "home": {
      "url": "https://example.edu/",
      "title": "Example University",
      "publisher": "Example University",
      "retrievedAt": "2026-10-17"
    },
    "program": {
      "url": "https://example.edu/cs",
      "title": "Computer Science",
      "publisher": "Example University",
      "retrievedAt": "2026-10-17",
      "effectiveAt": "2027 entry"
    },
    "fees": {
      "url": "https://example.edu/fees",
      "title": "Tuition and fees",
      "publisher": "Example University",
      "retrievedAt": "2026-10-17",
      "effectiveAt": "2026–27 academic year"
    }
  }
}
```

The example above is illustrative, not real data. Do not copy its numbers.

## Rules of thumb

- `profileSource` supports identity claims (name, website) and is always counted as used.
- Every key in `sources` must be used by at least one fact.
- `retrievedAt` is the date **you** opened the page (ISO `YYYY-MM-DD`), never a future date and never the page's “last updated” date.
- `academicYear` and `intake` are required on fees and deadlines. Institution-wide items also require `degreeLevel`; programme items inherit the programme's degree level and must set the programme id automatically (do not write `programId`).
- A fee amount must be positive. `kind: "exact"` requires `min === max`; `kind: "range"` requires `max ≥ min`.
- Only use `"all"` for applicant category when the source explicitly says the rule applies to all applicants.
- Put uncertainty in `notes` or `dataNotes`, not in invented values. If the page does not state something, omit it.
- Prefer one source key per page. Do not use a search-result or third-party aggregator as the source for a fact.
- Run `npm run ingest -- --offline` and inspect `git diff` before committing. The build validates the expanded profile; a schema error aborts the whole ingest.

## Reference files

- `oxford.json` — institution-wide fee range, programmes, deadline, recognition, scholarships.
- `toronto.json` — campus-specific programme, first-year fee estimates for three applicant categories, domestic/international deadlines, explicit “not every campus” note.
- `wiut.json` — non-English-currency fees (UZS) for domestic and international applicants, a 2026/27 programme with entry requirements, programme-level accreditation wording and a deadline that has already passed.
