import { createHash } from 'node:crypto';
import type {
  CountryRef,
  Institution,
  ListingScope,
  Location,
  Region,
  SourceRef,
} from '../../shared/types';
import { canonicalDomain, foldText, slugify } from '../../shared/text';
import type { FetchedSource } from './sources';

/* ------------------------------- raw types ------------------------------- */

interface RorName {
  lang?: string | null;
  types?: string[];
  value?: string;
}

interface RorLocation {
  geonames_details?: {
    continent_name?: string | null;
    country_code?: string | null;
    country_name?: string | null;
    country_subdivision_name?: string | null;
    name?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
}

export interface RorOrganisation {
  id?: string;
  names?: RorName[];
  locations?: RorLocation[];
  types?: string[];
  status?: string;
  domains?: string[];
  links?: Array<{ type?: string; value?: string }>;
  established?: number | null;
}

export interface HipoEntry {
  name?: string;
  country?: string;
  domains?: string[];
  web_pages?: string[];
  alpha_two_code?: string;
  'state-province'?: string | null;
}

/* ------------------------------ helpers --------------------------------- */

const REGION_BY_CONTINENT: Record<string, Region> = {
  Africa: 'Africa',
  Asia: 'Asia',
  Europe: 'Europe',
  Oceania: 'Oceania',
  'North America': 'Americas',
  'South America': 'Americas',
  Antarctica: 'Other',
};

function regionFromContinent(value: string | null | undefined): Region {
  return REGION_BY_CONTINENT[value ?? ''] ?? 'Other';
}

function countryRef(code: string, name: string | null | undefined): CountryRef {
  return { code: code.toUpperCase(), name: name?.trim() || code.toUpperCase() };
}

function validHttp(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function websiteFromLinks(links: RorOrganisation['links']): string | null {
  const websites = (links ?? [])
    .filter((link) => link.type === 'website')
    .map((link) => validHttp(link.value))
    .filter((value): value is string => Boolean(value));
  return websites.find((value) => value.startsWith('https://')) ?? websites[0] ?? null;
}

function websiteFromHipo(entry: HipoEntry): string | null {
  const pages = (entry.web_pages ?? []).map((page) => validHttp(page)).filter(Boolean) as string[];
  return pages.find((page) => page.startsWith('https://')) ?? pages[0] ?? null;
}

function dedupeStrings(values: string[], limit = 40): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = foldText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

const UNIVERSITY_HINTS = [
  /univers/,
  /college/,
  /polytechn/,
  /hochschul/,
  /hogeschool/,
  /yliopisto/,
  /korkeakoulu/,
  /haskol/,
  /hogskol/,
  /universit/,
  /egyetem/,
  /πανεπιστημ/,
  /جامع/,
  /دانشگاه/,
  /大学/,
  /大學/,
  /学院/,
  /學院/,
  /대학/,
  /महाविद्यालय/,
  /विश्वविद्यालय/,
  /বিশ্ববিদ্যালয়/,
  /பல்கலைக்கழக/,
  /אוניברסיט/,
  /უნივერსიტეტ/,
  /համալսարան/,
  /универ/,
  /универзит/,
  /institute of technology/,
  /institut polytechnique/,
  /instituto tecnologico/,
  /instituto superior/,
  /school of economics/,
  /school of mines/,
  /conservator/,
  /academy of art/,
  /chuo kikuu/,
  /đại học/,
  /dai hoc/,
  /มหาวิทยาลัย/,
  /pamantasan/,
  /collegium/,
];

const NON_UNIVERSITY_HINTS = [
  /hospital/,
  /medical cent(?:er|re)/,
  /research (?:institute|center|centre|foundation|unit|council)/,
  /laborator/,
  /observator/,
  /museum/,
  /library/,
  /consortium/,
  /mental health/,
  /clinic/,
  /high school|secondary school|primary school|middle school/,
  /school district/,
  /academy of sciences/,
  /national academy/,
  /\b(?:inc|incorporated|ltd|llc|gmbh|plc|oy|ab)\b/,
  /university press/,
  /alumni/,
  /students? union/,
  /third age/,
  /university foundation/,
  /university hospital/,
  /science academy/,
  /company/,
  /corporation/,
];

const CLEARLY_NOT_UNIVERSITY = [
  /seminary/,
  /bible college/,
  /yeshiva/,
  /film school/,
  /language school/,
  /driving school/,
  /beauty school/,
  /high school|secondary school|primary school|middle school|kindergarten/,
];

export function inferKind(name: string): Institution['kind'] {
  const folded = foldText(name);
  if (/polytechn|technical university|technische universitat|institute of technology|instituto tecnologico|school of mines/.test(folded)) {
    return 'technical-university';
  }
  if (/univers|collegium|chuo kikuu|dai hoc|đại học|egyetem|yliopisto|haskol|hogskol|πανεπιστημ|جامع|دانشگاه|大学|大學|대학|универ|אוניברסיט|համալսարան|უნივერსიტეტ|বিশ্ববিদ্যালয়|विश्वविद्यालय|பல்கலைக்கழக|महाविद्यालय|มหาวิทยาลัย|pamantasan/.test(folded)) {
    return 'university';
  }
  if (/college|hogeschool|korkeakoulu|hochschul|学院|學院/.test(folded)) return 'college';
  if (/institute|institut/.test(folded)) return 'institute';
  if (/academy|academie|conservator/.test(folded)) return 'academy';
  return 'not-classified';
}

export function isClearlyNotUniversity(name: string): boolean {
  const folded = foldText(name);
  return CLEARLY_NOT_UNIVERSITY.some((pattern) => pattern.test(folded));
}

export function looksLikeUniversity(names: string[]): boolean {
  const folded = names.map((name) => foldText(name)).filter(Boolean);
  if (folded.length === 0) return false;
  if (folded.some((name) => NON_UNIVERSITY_HINTS.some((pattern) => pattern.test(name)))) {
    return false;
  }
  return folded.some((name) => UNIVERSITY_HINTS.some((pattern) => pattern.test(name)));
}

function rorSuffix(rorUrl: string): string {
  const value = rorUrl.split('/').filter(Boolean).pop() ?? '';
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase() || createHash('sha1').update(rorUrl).digest('hex').slice(0, 9);
}

function directorySourceRef(fetched: FetchedSource, kind: 'ror' | 'hipo'): SourceRef {
  if (kind === 'ror') {
    return {
      url: 'https://ror.readme.io/docs/data-dump',
      title: `ROR data dump ${fetched.release}`,
      publisher: 'Research Organization Registry (ROR)',
      retrievedAt: fetched.retrievedAt,
      publishedAt: fetched.publishedAt,
      effectiveAt: `ROR release ${fetched.release}`,
      license: 'CC0 1.0',
    };
  }
  return {
    url: 'https://github.com/Hipo/university-domains-list',
    title: 'Hipo university domains list',
    publisher: 'Hipo (community project)',
    retrievedAt: fetched.retrievedAt,
    publishedAt: null,
    effectiveAt: `Directory snapshot ${fetched.release}`,
    license: 'MIT',
  };
}

function rorSourceRef(organisation: RorOrganisation, fetched: FetchedSource): SourceRef {
  const base = directorySourceRef(fetched, 'ror');
  const suffix = organisation.id ? rorSuffix(organisation.id) : null;
  return suffix ? { ...base, url: `https://ror.org/${suffix}`, title: 'ROR record' } : base;
}

const DIRECTORY_NOTE = 'Directory record only. No official university page was checked for this release.';
const ROR_NOTE = 'ROR is a research-organisation registry, not a university or accreditation register.';
const HIPO_NOTE = 'Hipo is a community-maintained directory; it is not an official register or accreditation source.';

/* ---------------------------- build records ----------------------------- */

export interface DirectoryBuild {
  records: Institution[];
  rorCount: number;
  hipoCount: number;
  hipoOnly: number;
  merged: number;
  activeEducation: number;
  universityScope: number;
  educationScope: number;
  countries: Map<string, { name: string; region: Region }>;
  scopeByCountry: Map<string, { university: number; education: number }>;
}

interface RorIndexes {
  byDomain: Map<string, Institution[]>;
  byNameCountry: Map<string, Institution[]>;
}

function nameIndexKey(name: string, countryCode: string): string {
  return `${foldText(name)}\u0000${countryCode}`;
}

function buildNameIndex(records: Institution[]): Map<string, Institution[]> {
  const index = new Map<string, Institution[]>();
  for (const record of records) {
    const names = new Set(
      [
        record.names.primary,
        ...record.names.aliases,
        ...record.names.localNames.map((item) => item.value),
        ...record.names.formerNames,
      ]
        .map((name) => foldText(name))
        .filter(Boolean),
    );
    for (const name of names) {
      const key = nameIndexKey(name, record.country.code);
      const list = index.get(key) ?? [];
      list.push(record);
      index.set(key, list);
    }
  }
  return index;
}

function buildDomainIndex(records: Institution[]): Map<string, Institution[]> {
  const index = new Map<string, Institution[]>();
  for (const record of records) {
    for (const domain of record.domains) {
      const list = index.get(domain) ?? [];
      list.push(record);
      index.set(domain, list);
    }
  }
  return index;
}

function mapRorOrganisation(organisation: RorOrganisation, fetched: FetchedSource): Institution | null {
  if (!organisation.id) return null;
  const rawNames = (organisation.names ?? []).filter((name) => name.value?.trim());
  const display =
    rawNames.find((name) => name.types?.includes('ror_display')) ??
    rawNames.find((name) => name.types?.includes('label') && name.lang === 'en') ??
    rawNames.find((name) => name.types?.includes('label')) ??
    rawNames[0];
  if (!display?.value) return null;

  const primary = display.value.trim();
  const aliases: string[] = [];
  const localNames: Institution['names']['localNames'] = [];
  for (const name of rawNames) {
    if (!name.value || name.value.trim() === primary) continue;
    const lang = name.lang ?? 'und';
    const latin = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u.test(name.value);
    if (lang === 'en' || (lang === 'und' && latin)) {
      aliases.push(name.value.trim());
    } else {
      localNames.push({
        lang,
        value: name.value.trim(),
        source: 'ror',
        type: name.types?.[0] ?? 'label',
      });
    }
  }

  const locations: Location[] = [];
  for (const [index, entry] of (organisation.locations ?? []).slice(0, 8).entries()) {
    const detail = entry.geonames_details;
    if (!detail?.country_code) continue;
    locations.push({
      city: detail.name?.trim() || null,
      region: detail.country_subdivision_name?.trim() || null,
      countryCode: detail.country_code.toUpperCase(),
      countryName: detail.country_name?.trim() || detail.country_code.toUpperCase(),
      latitude: typeof detail.lat === 'number' ? detail.lat : null,
      longitude: typeof detail.lng === 'number' ? detail.lng : null,
      role: index === 0 ? 'primary' : 'additional',
      source: 'ror',
    });
  }
  const primaryLocation =
    locations.find((location) => location.role === 'primary') ?? locations[0] ?? null;
  const country = primaryLocation
    ? countryRef(primaryLocation.countryCode, primaryLocation.countryName)
    : null;
  if (!country) return null;
  const primaryContinent =
    (organisation.locations ?? [])[0]?.geonames_details?.continent_name ?? null;

  const suffix = rorSuffix(organisation.id);
  const uniLike = looksLikeUniversity([primary, ...aliases, ...localNames.map((name) => name.value)]);
  const scope: ListingScope = uniLike ? 'university' : 'education';
  const rorLink = rorSourceRef(organisation, fetched);
  const dataNotes = [DIRECTORY_NOTE, ROR_NOTE];
  if (scope === 'university') {
    dataNotes.push('University scope is based on a multilingual name heuristic, not an official classification.');
  }
  if (!locations.some((location) => location.city)) {
    dataNotes.push('No city is recorded in the ROR directory for this record.');
  }

  return {
    id: `ror-${suffix}`,
    rorId: organisation.id,
    domains: dedupeStrings((organisation.domains ?? []).map((domain) => canonicalDomain(domain) ?? ''), 20),
    names: {
      primary,
      official: null,
      aliases: dedupeStrings(aliases, 30),
      localNames: localNames.slice(0, 30),
      formerNames: [],
    },
    country,
    region: regionFromContinent(primaryContinent),
    locations,
    website: websiteFromLinks(organisation.links),
    kind: inferKind(primary),
    scope,
    listing: {
      hipo: false,
      ror: true,
      curated: false,
      scopeBasis: uniLike ? 'university-name-heuristic' : 'ror-education',
      basisNote: uniLike
        ? 'ROR education organisation with a university-like name (heuristic, not an official classification).'
        : 'ROR education organisation; university status has not been classified.',
    },
    established: typeof organisation.established === 'number' ? organisation.established : null,
    languages: [],
    studyModes: [],
    campuses: [],
    recognition: [],
    programs: [],
    tuition: [],
    scholarships: [],
    admissions: { requirements: [], deadlines: [], links: [] },
    verification: {
      level: 'directory-only',
      lastCheckedAt: null,
      checkedFacts: 0,
      note: 'We have not read this institution’s official pages for this release. No programme, fee, deadline, scholarship or recognition facts are shown.',
    },
    sources: [rorLink],
    dataNotes,
  };
}

function mapRegionForCountry(
  countryCode: string,
  countryMap: Map<string, { name: string; region: Region }>,
): Region {
  return countryMap.get(countryCode)?.region ?? 'Other';
}

function createHipoRecord(
  entry: HipoEntry,
  countryMap: Map<string, { name: string; region: Region }>,
  fetched: FetchedSource,
): Institution | null {
  const name = entry.name?.trim();
  const code = entry.alpha_two_code?.toUpperCase();
  if (!name || !code) return null;
  const domains = dedupeStrings((entry.domains ?? []).map((domain) => canonicalDomain(domain) ?? ''), 20);
  const stable = createHash('sha256')
    .update(`${foldText(name)}|${code}|${domains[0] ?? ''}`)
    .digest('hex')
    .slice(0, 10);
  const countryName = countryMap.get(code)?.name ?? entry.country?.trim() ?? code;
  const region = mapRegionForCountry(code, countryMap);
  const state = entry['state-province']?.trim() || null;
  const source = directorySourceRef(fetched, 'hipo');
  const universityScope = !isClearlyNotUniversity(name);
  const dataNotes = [DIRECTORY_NOTE, HIPO_NOTE, 'University status is not independently verified for this directory listing.'];
  if (!universityScope) {
    dataNotes.push('The listing name indicates a specialised or pre-university institution; it is kept in the broader education scope rather than presented as a university.');
  }
  if (!state) dataNotes.push('No city or region is recorded in the Hipo listing.');

  return {
    id: `dir-${stable}`,
    rorId: null,
    domains,
    names: {
      primary: name,
      official: null,
      aliases: [],
      localNames: [],
      formerNames: [],
    },
    country: countryRef(code, countryName),
    region,
    locations: [
      {
        city: null,
        region: state,
        countryCode: code,
        countryName,
        latitude: null,
        longitude: null,
        role: 'primary',
        source: 'hipo',
      },
    ],
    website: websiteFromHipo(entry),
    kind: inferKind(name),
    scope: universityScope ? 'university' : 'education',
    listing: {
      hipo: true,
      ror: false,
      curated: false,
      scopeBasis: 'hipo-directory',
      basisNote: universityScope
        ? 'Listed in the community Hipo university directory. Not an official register; university status is not verified.'
        : 'Listed in the community Hipo university directory, but the name indicates a specialised or pre-university institution. Kept in the broader education scope.',
    },
    established: null,
    languages: [],
    studyModes: [],
    campuses: [],
    recognition: [],
    programs: [],
    tuition: [],
    scholarships: [],
    admissions: { requirements: [], deadlines: [], links: [] },
    verification: {
      level: 'directory-only',
      lastCheckedAt: null,
      checkedFacts: 0,
      note: 'We have not read this institution’s official pages for this release. No programme, fee, deadline, scholarship or recognition facts are shown.',
    },
    sources: [source],
    dataNotes,
  };
}

function mergeHipoIntoRor(record: Institution, entry: HipoEntry, fetched: FetchedSource): void {
  const name = entry.name?.trim();
  const domains = (entry.domains ?? []).map((domain) => canonicalDomain(domain) ?? '').filter(Boolean);
  record.domains = dedupeStrings([...record.domains, ...domains], 20);
  if (name && foldText(name) !== foldText(record.names.primary)) {
    record.names.aliases = dedupeStrings([name, ...record.names.aliases], 30);
  }
  if (!record.website) record.website = websiteFromHipo(entry);
  record.listing.hipo = true;
  if (record.listing.scopeBasis === 'ror-education') {
    record.listing.scopeBasis = 'hipo-ror';
  }
  record.listing.basisNote = 'Hipo directory listing enriched with ROR metadata. Neither source is an official university register.';
  record.scope = isClearlyNotUniversity(record.names.primary) ? 'education' : 'university';
  record.sources = [
    directorySourceRef(fetched, 'hipo'),
    ...record.sources.filter((source) => !source.title.startsWith('Hipo')),
  ];
  if (!record.dataNotes.includes(HIPO_NOTE)) record.dataNotes.push(HIPO_NOTE);
}

export function buildDirectory(
  rorOrganisations: RorOrganisation[],
  hipoEntries: HipoEntry[],
  rorFetched: FetchedSource,
  hipoFetched: FetchedSource,
): DirectoryBuild {
  let activeEducation = 0;
  const rorRecords: Institution[] = [];
  for (const organisation of rorOrganisations) {
    if (organisation.status !== 'active') continue;
    if (!organisation.types?.includes('education')) continue;
    activeEducation += 1;
    const mapped = mapRorOrganisation(organisation, rorFetched);
    if (mapped) rorRecords.push(mapped);
  }

  // Country and region reference table from ROR. Hipo-only records inherit the
  // same continent classification; unknown codes stay "Other".
  const countries = new Map<string, { name: string; region: Region }>();
  for (const record of rorRecords) {
    const existing = countries.get(record.country.code);
    if (!existing) {
      countries.set(record.country.code, { name: record.country.name, region: record.region });
    } else if (existing.region === 'Other' && record.region !== 'Other') {
      countries.set(record.country.code, { name: existing.name, region: record.region });
    }
  }

  const byDomain: Map<string, Institution[]> = buildDomainIndex(rorRecords);
  const byName: Map<string, Institution[]> = buildNameIndex(rorRecords);
  const hipoById = new Map<string, Institution>();
  const hipoByName = new Map<string, Institution>();
  let merged = 0;

  for (const entry of hipoEntries) {
    const name = entry.name?.trim();
    const code = entry.alpha_two_code?.toUpperCase();
    if (!name || !code) continue;
    const existingKey = `${foldText(name)}\u0000${code}`;
    const duplicateOf = hipoByName.get(existingKey);
    if (duplicateOf) {
      const domains = (entry.domains ?? []).map((domain) => canonicalDomain(domain) ?? '').filter(Boolean);
      duplicateOf.domains = dedupeStrings([...duplicateOf.domains, ...domains], 20);
      continue;
    }

    const domains = (entry.domains ?? []).map((domain) => canonicalDomain(domain) ?? '').filter(Boolean);
    const domainCandidates = new Map<string, Institution>();
    for (const domain of domains) {
      for (const candidate of byDomain.get(domain) ?? []) {
        if (candidate.country.code === code) domainCandidates.set(candidate.id, candidate);
      }
    }
    let target: Institution | null = null;
    if (domainCandidates.size === 1) {
      target = [...domainCandidates.values()][0] ?? null;
    } else if (domainCandidates.size > 1) {
      const folded = foldText(name);
      const nameMatches = [...domainCandidates.values()].filter((candidate) =>
        [candidate.names.primary, ...candidate.names.aliases, ...candidate.names.localNames.map((n) => n.value)].some(
          (candidateName) => foldText(candidateName) === folded,
        ),
      );
      if (nameMatches.length === 1) target = nameMatches[0] ?? null;
    }
    if (!target) {
      const nameMatches = byName.get(nameIndexKey(name, code)) ?? [];
      if (nameMatches.length === 1) target = nameMatches[0] ?? null;
    }

    if (target) {
      mergeHipoIntoRor(target, entry, hipoFetched);
      merged += 1;
      hipoByName.set(existingKey, target);
      continue;
    }

    const record = createHipoRecord(entry, countries, hipoFetched);
    if (!record) continue;
    if (hipoById.has(record.id)) {
      const existing = hipoById.get(record.id)!;
      existing.domains = dedupeStrings([...existing.domains, ...record.domains], 20);
      continue;
    }
    hipoById.set(record.id, record);
    hipoByName.set(existingKey, record);
  }

  const records = [...rorRecords, ...hipoById.values()];
  const seenIds = new Set<string>();
  for (const record of records) {
    if (seenIds.has(record.id)) {
      record.id = `${record.id}-2`;
    }
    seenIds.add(record.id);
  }

  const scopeByCountry = new Map<string, { university: number; education: number }>();
  for (const record of records) {
    const entry = scopeByCountry.get(record.country.code) ?? { university: 0, education: 0 };
    if (record.scope === 'university') entry.university += 1;
    else entry.education += 1;
    scopeByCountry.set(record.country.code, entry);
  }

  return {
    records,
    rorCount: rorRecords.length,
    hipoCount: hipoEntries.length,
    hipoOnly: hipoById.size,
    merged,
    universityScope: records.filter((record) => record.scope === 'university').length,
    educationScope: records.filter((record) => record.scope === 'education').length,
    countries,
    scopeByCountry,
    activeEducation,
  };
}

export function slugForRecord(name: string): string {
  return slugify(name).slice(0, 50) || 'institution';
}
