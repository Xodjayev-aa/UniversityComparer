import type {
  DegreeLevel,
  Facets,
  InstitutionSummary,
  Region,
  SearchResponse,
  SearchWithheld,
} from '../shared/types.js';
import { DEGREE_LEVELS, SUBJECTS, languageLabel } from '../shared/taxonomy.js';
import { compactText, foldText } from '../shared/text.js';
import { summarize, type DataStore, type SearchEntry } from './data.js';

export type SearchScope = 'university' | 'education' | 'all';

export interface SearchInput {
  q: string;
  scope: SearchScope;
  country: string | null;
  region: Region | null;
  degree: DegreeLevel | null;
  language: string | null;
  mode: 'full-time' | 'part-time' | null;
  subject: string | null;
  fees: boolean;
  profileOnly: boolean;
  page: number;
  pageSize: number;
  sort: 'relevance' | 'name';
}

const REGIONS = new Set<string>(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Other']);
const DEGREES = new Set<string>(DEGREE_LEVELS.map((level) => level.id));
const SUBJECTS_SET = new Set<string>(SUBJECTS.map((subject) => subject.id));

function intParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSearchParams(params: URLSearchParams): SearchInput {
  const scopeRaw = params.get('scope');
  const scope: SearchScope = scopeRaw === 'all' ? 'all' : scopeRaw === 'education' ? 'education' : 'university';
  const country = (params.get('country') ?? '').toUpperCase();
  const region = params.get('region') ?? '';
  const degree = params.get('degree') ?? '';
  const mode = params.get('mode') ?? '';
  const subject = params.get('subject') ?? '';
  const language = (params.get('language') ?? '').trim().toLowerCase().slice(0, 20);
  const page = Math.min(100_000, Math.max(1, intParam(params.get('page')) ?? 1));
  const pageSize = Math.min(100, Math.max(1, intParam(params.get('pageSize')) ?? 20));
  return {
    q: (params.get('q') ?? '').trim().slice(0, 120),
    scope,
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: REGIONS.has(region) ? (region as Region) : null,
    degree: DEGREES.has(degree) ? (degree as DegreeLevel) : null,
    language: language || null,
    mode: mode === 'full-time' || mode === 'part-time' ? mode : null,
    subject: SUBJECTS_SET.has(subject) ? subject : null,
    fees: params.get('fees') === 'source-checked',
    profileOnly: params.get('profile') === 'source-checked',
    page,
    pageSize,
    sort: params.get('sort') === 'name' ? 'name' : 'relevance',
  };
}

interface MatchResult {
  score: number;
  matchedOn: string | null;
}

export function matchQuery(entry: SearchEntry, rawQuery: string): MatchResult {
  const query = foldText(rawQuery);
  if (!query) return { score: 0, matchedOn: null };
  const compactQuery = compactText(rawQuery);
  const tokens = query.split(' ').filter(Boolean);
  let best: MatchResult = { score: 0, matchedOn: null };

  const consider = (score: number, matchedOn: string) => {
    if (score > best.score) best = { score, matchedOn };
  };

  for (const name of entry.names) {
    const base =
      name.kind === 'primary'
        ? 900
        : name.kind === 'official'
          ? 760
          : name.kind === 'local'
            ? 740
            : name.kind === 'former'
              ? 700
              : 720;
    if (name.folded === query) consider(base + 100, labelForKind(name.kind));
    else if (name.folded.startsWith(query)) consider(base + 50, labelForKind(name.kind));
    else if (name.folded.includes(query)) consider(base, labelForKind(name.kind));
    else if (name.compact === compactQuery) consider(base + 70, labelForKind(name.kind));
    else if (compactQuery.length >= 3 && name.compact.includes(compactQuery)) consider(base - 40, labelForKind(name.kind));
    if (tokens.length > 1 && tokens.every((token) => name.folded.includes(token))) {
      consider(base - 20, labelForKind(name.kind));
    }
  }

  for (const city of entry.cityFolded) {
    if (city === query) consider(300, 'city');
    else if (city.startsWith(query)) consider(260, 'city');
    else if (city.includes(query)) consider(230, 'city');
  }

  if (entry.countryFolded === query) consider(180, 'country');
  else if (entry.countryFolded.startsWith(query)) consider(160, 'country');
  else if (entry.countryFolded.includes(query)) consider(140, 'country');
  if (entry.countryCode.toLowerCase() === query) consider(190, 'country code');
  if (entry.region.toLowerCase() === query) consider(120, 'region');

  if (best.score === 0 && tokens.length > 0 && tokens.every((token) => entry.allTokens.has(token))) {
    consider(60 + tokens.length * 5, 'name, city or country');
  }
  return best;
}

function labelForKind(kind: SearchEntry['names'][number]['kind']): string {
  switch (kind) {
    case 'primary':
      return 'name';
    case 'official':
      return 'official name';
    case 'alternate':
      return 'alternate name';
    case 'local':
      return 'local-script name';
    case 'former':
      return 'former name';
  }
}

function passesNonProgramFilters(entry: SearchEntry, input: SearchInput): boolean {
  if (input.country && entry.countryCode !== input.country) return false;
  if (input.region && entry.region !== input.region) return false;
  if (input.profileOnly && !entry.verified) return false;
  return true;
}

function hasProgramFilters(input: SearchInput): boolean {
  return Boolean(input.degree || input.subject || input.mode || input.language);
}

function passesProgramFilters(
  entry: SearchEntry,
  input: SearchInput,
): { ok: boolean; programUnknown: boolean; languageUnknown: boolean } {
  if (!hasProgramFilters(input)) return { ok: true, programUnknown: false, languageUnknown: false };
  if (entry.programCount === 0) {
    return { ok: false, programUnknown: true, languageUnknown: Boolean(input.language) };
  }
  if (input.degree && !entry.degrees.has(input.degree)) return { ok: false, programUnknown: false, languageUnknown: false };
  if (input.subject && !entry.subjects.has(input.subject)) return { ok: false, programUnknown: false, languageUnknown: false };
  if (input.mode && !entry.studyModes.has(input.mode)) return { ok: false, programUnknown: false, languageUnknown: false };
  if (input.language) {
    if (entry.languages.size === 0) return { ok: false, programUnknown: false, languageUnknown: true };
    if (!entry.languages.has(input.language)) return { ok: false, programUnknown: false, languageUnknown: false };
  }
  return { ok: true, programUnknown: false, languageUnknown: false };
}

function scopeAllows(entry: SearchEntry, scope: SearchScope): boolean {
  if (scope === 'all') return true;
  return entry.record.scope === scope;
}

export function searchStore(store: DataStore, input: SearchInput): SearchResponse {
  const scored = store.entries.map((entry) => ({ entry, match: matchQuery(entry, input.q) }));
  const scopeCounts = { university: 0, education: 0 };
  const withheld: SearchWithheld = { programDataUnknown: 0, feeDataUnknown: 0, languageUnknown: 0 };
  const matched: Array<{ entry: SearchEntry; match: MatchResult }> = [];

  for (const candidate of scored) {
    const { entry, match } = candidate;
    if (input.q && match.score === 0) continue;
    if (!passesNonProgramFilters(entry, input)) continue;
    const program = passesProgramFilters(entry, input);
    if (!program.ok) {
      if (program.programUnknown) withheld.programDataUnknown += 1;
      if (program.languageUnknown) withheld.languageUnknown += 1;
      if (input.fees && !entry.hasFeeFacts) withheld.feeDataUnknown += 1;
      continue;
    }
    if (input.fees && !entry.hasFeeFacts) {
      withheld.feeDataUnknown += 1;
      continue;
    }
    // Scope counts describe the same query and filters, ignoring scope only.
    if (entry.record.scope === 'university') scopeCounts.university += 1;
    else scopeCounts.education += 1;
    if (!scopeAllows(entry, input.scope)) continue;
    matched.push({ entry, match });
  }

  matched.sort((a, b) => {
    if (input.sort === 'name' || !input.q) {
      if (a.entry.verified !== b.entry.verified) return a.entry.verified ? -1 : 1;
      return a.entry.sortName.localeCompare(b.entry.sortName, 'en') || a.entry.countryCode.localeCompare(b.entry.countryCode);
    }
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    if (a.entry.verified !== b.entry.verified) return a.entry.verified ? -1 : 1;
    return a.entry.sortName.localeCompare(b.entry.sortName, 'en');
  });

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  const start = (page - 1) * input.pageSize;
  const items: InstitutionSummary[] = matched
    .slice(start, start + input.pageSize)
    .map(({ entry, match }) => summarize(entry.record, match.matchedOn));

  const notices: string[] = [];
  const withheldTotal = withheld.programDataUnknown + withheld.feeDataUnknown + withheld.languageUnknown;
  if (withheldTotal > 0) {
    const parts: string[] = [];
    if (withheld.programDataUnknown > 0) parts.push(`${withheld.programDataUnknown} for missing programme data`);
    if (withheld.languageUnknown > 0) parts.push(`${withheld.languageUnknown} for missing teaching-language data`);
    if (withheld.feeDataUnknown > 0) parts.push(`${withheld.feeDataUnknown} for missing fee data`);
    notices.push(
      `Records were excluded from this result set (${parts.join(', ')}). They are unknown, not evidence that the university lacks the attribute or charges nothing.`,
    );
  }
  if (input.scope === 'all') {
    notices.push(
      'This scope includes ROR education organisations whose names did not pass the university-name heuristic. They are marked “broader education record” and are not claimed as universities.',
    );
  }
  if (input.q && total === 0) {
    notices.push(
      'No directory records matched. Directory coverage is not complete, so this does not mean the institution does not exist. Try a shorter name, a local-script name, a city or a country.',
    );
  }
  if (store.coverage.totals.sourceChecked === 0 && (input.profileOnly || input.fees || hasProgramFilters(input))) {
    notices.push('No source-checked profiles exist in this data release, so programme, fee and language filters cannot return matches yet.');
  }
  if (!input.q && input.scope === 'university') {
    notices.push(
      'Browsing without a search term shows directory records sorted with source-checked profiles first. It is not a ranking of quality.',
    );
  }

  return {
    query: input.q,
    page,
    pageSize: input.pageSize,
    total,
    pageCount,
    items,
    scopeCounts,
    withheld,
    notices,
  };
}

export function buildFacets(store: DataStore): Facets {
  const countries = new Map<string, { code: string; name: string; region: Region; universityRecords: number; sourceChecked: number }>();
  const subjects = new Map<string, { programCount: number; institutions: Set<string> }>();
  const languages = new Map<string, number>();
  const degrees = new Map<DegreeLevel, number>();

  for (const entry of store.entries) {
    if (entry.record.scope === 'university') {
      const country = countries.get(entry.countryCode) ?? {
        code: entry.countryCode,
        name: entry.record.country.name,
        region: entry.record.region,
        universityRecords: 0,
        sourceChecked: 0,
      };
      country.universityRecords += 1;
      if (entry.verified) country.sourceChecked += 1;
      countries.set(entry.countryCode, country);
    }
    for (const program of entry.record.programs) {
      const subject = subjects.get(program.subjectArea) ?? { programCount: 0, institutions: new Set<string>() };
      subject.programCount += 1;
      subject.institutions.add(entry.id);
      subjects.set(program.subjectArea, subject);
      if (program.language) languages.set(program.language, (languages.get(program.language) ?? 0) + 1);
      degrees.set(program.degreeLevel, (degrees.get(program.degreeLevel) ?? 0) + 1);
    }
  }

  return {
    countries: [...countries.values()]
      .filter((country) => country.universityRecords > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'en')),
    subjects: SUBJECTS.filter((subject) => (subjects.get(subject.id)?.programCount ?? 0) > 0).map((subject) => ({
      id: subject.id,
      label: subject.label,
      programCount: subjects.get(subject.id)?.programCount ?? 0,
      institutionCount: subjects.get(subject.id)?.institutions.size ?? 0,
    })),
    languages: [...languages.entries()]
      .map(([code, programCount]) => ({ code, label: languageLabel(code), programCount }))
      .sort((a, b) => b.programCount - a.programCount || a.label.localeCompare(b.label)),
    degreeLevels: DEGREE_LEVELS.map((level) => ({
      id: level.id,
      label: level.label,
      programCount: degrees.get(level.id) ?? 0,
    })),
    totals: store.coverage.totals,
  };
}
