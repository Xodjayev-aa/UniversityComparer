## What changed

## Data honesty checklist

- [ ] New or changed facts were read on the linked official page; `retrievedAt` is the date it was read, not the page's update date.
- [ ] Each fee has an academic year, applicant category, unit and coverage; no currency conversion was added.
- [ ] Missing information is omitted or labelled — no zeros, guesses or “free” placeholders.
- [ ] No ranking, quality score, personal-fit score or admission prediction was added.
- [ ] Directory sources are still discovery-only; no accreditation claim relies on a directory.
- [ ] Directory records still carry no researched facts; research files pass `npm run ingest`.

## Checks

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run validate:data`
- [ ] `npm run build`
- [ ] Checked the affected pages at mobile width and with keyboard navigation
- [ ] If sources or counts changed: `npm run coverage:doc` committed, coverage page reviewed
