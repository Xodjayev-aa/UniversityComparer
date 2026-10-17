import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type {
  CoverageStats,
  Institution,
  InstitutionSummary,
  InstitutionVerification,
  SourceInfo,
} from '../shared/types.js';
import { foldText, compactText } from '../shared/text.js';
import { buildCoverage } from '../scripts/lib/coverage.js';
import { institutionDatasetSchema } from '../shared/schema.js';

export class DataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataUnavailableError';
  }
}

export interface DatasetMeta {
  schemaVersion: 1;
  generatedAt: string;
  directoryAsOf: string;
  sources: SourceInfo[];
  institutions: Institution[];
}

export interface SearchableName {
  value: string;
  folded: string;
  compact: string;
  kind: 'primary' | 'alternate' | 'local' | 'former' | 'official';
}

export interface SearchEntry {
  id: string;
  record: Institution;
  names: SearchableName[];
  primaryFolded: string;
  primaryCompact: string;
  cities: string[];
  cityFolded: string[];
  countryFolded: string;
  countryCode: string;
  region: string;
  programCount: number;
  degrees: Set<string>;
  languages: Set<string>;
  subjects: Set<string>;
  studyModes: Set<string>;
  feeFactCount: number;
  deadlineCount: number;
  recognitionCount: number;
  hasFeeFacts: boolean;
  verified: boolean;
  sortName: string;
  allFolded: string;
  allTokens: Set<string>;
}

function namesFor(record: Institution): SearchableName[] {
  const list: SearchableName[] = [];
  const add = (value: string, kind: SearchableName['kind']) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const folded = foldText(trimmed);
    if (!folded) return;
    list.push({ value: trimmed, folded, compact: compactText(trimmed), kind });
  };
  add(record.names.primary, 'primary');
  if (record.names.official) add(record.names.official, 'official');
  for (const alias of record.names.aliases) add(alias, 'alternate');
  for (const local of record.names.localNames) add(local.value, 'local');
  for (const former of record.names.formerNames) add(former, 'former');
  const seen = new Set<string>();
  return list.filter((name) => {
    const key = `${name.folded}|${name.kind === 'primary' ? 'primary' : 'other'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function makeEntry(record: Institution): SearchEntry {
  const names = namesFor(record);
  const primary = names.find((name) => name.kind === 'primary') ?? names[0];
  const cities = [...new Set(record.locations.map((location) => location.city).filter((city): city is string => Boolean(city)))];
  const cityFolded = cities.map((city) => foldText(city)).filter(Boolean);
  const countryFolded = foldText(record.country.name);
  const programCount = record.programs.length;
  const degrees = new Set(record.programs.map((program) => program.degreeLevel));
  const languages = new Set(
    record.programs.map((program) => program.language).filter((value): value is string => Boolean(value)),
  );
  const subjects = new Set(record.programs.map((program) => program.subjectArea));
  const studyModes = new Set<string>([
    ...record.studyModes,
    ...record.programs.flatMap((program) => program.studyModes),
  ]);
  const feeFactCount =
    record.tuition.length + record.programs.reduce((sum, program) => sum + program.tuition.length, 0);
  const deadlineCount =
    record.admissions.deadlines.length +
    record.programs.reduce((sum, program) => sum + program.deadlines.length, 0);
  const allFolded = [
    ...names.map((name) => name.value),
    ...cities,
    record.country.name,
    record.region,
  ]
    .map((value) => foldText(value))
    .filter(Boolean)
    .join(' ');
  const allTokens = new Set(allFolded.split(' ').filter(Boolean));
  return {
    id: record.id,
    record,
    names,
    primaryFolded: primary?.folded ?? foldText(record.names.primary),
    primaryCompact: primary?.compact ?? compactText(record.names.primary),
    cities,
    cityFolded,
    countryFolded,
    countryCode: record.country.code,
    region: record.region,
    programCount,
    degrees,
    languages,
    subjects,
    studyModes,
    feeFactCount,
    deadlineCount,
    recognitionCount: record.recognition.length,
    hasFeeFacts: feeFactCount > 0,
    verified: record.verification.level === 'source-checked',
    sortName: foldText(record.names.primary),
    allFolded,
    allTokens,
  };
}

export function summarize(record: Institution, matchedOn: string | null = null): InstitutionSummary {
  const city = record.locations.find((location) => location.city)?.city ?? null;
  return {
    id: record.id,
    name: record.names.primary,
    country: record.country,
    region: record.region,
    city,
    website: record.website,
    scope: record.scope,
    listing: record.listing,
    verificationLevel: record.verification.level,
    programs: {
      count: record.programs.length,
      degreeLevels: [...new Set(record.programs.map((program) => program.degreeLevel))],
      languages: [...new Set(record.programs.map((program) => program.language).filter((value): value is string => Boolean(value)))],
      subjects: [...new Set(record.programs.map((program) => program.subjectArea))],
    },
    hasFeeFacts: record.tuition.length > 0 || record.programs.some((program) => program.tuition.length > 0),
    hasRecognition: record.recognition.length > 0,
    matchedOn,
  };
}

export class DataStore {
  readonly dataset: DatasetMeta;
  readonly coverage: CoverageStats;
  readonly byId: Map<string, Institution>;
  readonly entries: SearchEntry[];
  readonly dataDir: string;

  constructor(dataset: DatasetMeta, coverage: CoverageStats, dataDir = '') {
    this.dataset = dataset;
    this.coverage = coverage;
    this.dataDir = dataDir;
    this.byId = new Map(dataset.institutions.map((record) => [record.id, record]));
    this.entries = dataset.institutions.map(makeEntry);
  }

  get sourceCheckedCount(): number {
    return this.coverage.totals.sourceChecked;
  }
}

function resolveDataDir(explicit?: string): string {
  return path.resolve(explicit ?? process.env.UNISCOPE_DATA_DIR ?? path.join(process.cwd(), 'data', 'build'));
}

async function readDatasetFile(dataDir: string): Promise<{ json: string; file: string }> {
  const gzipPath = path.join(dataDir, 'institutions.json.gz');
  const jsonPath = path.join(dataDir, 'institutions.json');
  if (existsSync(gzipPath)) {
    const compressed = await readFile(gzipPath);
    return { json: gunzipSync(compressed).toString('utf8'), file: gzipPath };
  }
  if (existsSync(jsonPath)) {
    return { json: await readFile(jsonPath, 'utf8'), file: jsonPath };
  }
  throw new DataUnavailableError(
    `No dataset found in ${dataDir}. Run “npm run ingest” to build data/build/institutions.json.gz.`,
  );
}

export async function loadData(options: { dataDir?: string; validate?: boolean } = {}): Promise<DataStore> {
  const dataDir = resolveDataDir(options.dataDir);
  const { json, file } = await readDatasetFile(dataDir);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DataUnavailableError(`The dataset at ${file} is not valid JSON.`);
  }
  const candidate = parsed as Partial<DatasetMeta>;
  if (
    !candidate ||
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.institutions) ||
    typeof candidate.generatedAt !== 'string'
  ) {
    throw new DataUnavailableError('The dataset is missing a schemaVersion, generatedAt or institutions array.');
  }

  if (options.validate || process.env.UNISCOPE_VALIDATE_DATA === '1') {
    const validated = institutionDatasetSchema.safeParse(parsed);
    if (!validated.success) {
      throw new DataUnavailableError(
        `The dataset failed validation (${validated.error.issues.length} issues). First: ${validated.error.issues[0]?.message ?? 'unknown'}`,
      );
    }
  }

  const dataset: DatasetMeta = {
    schemaVersion: 1,
    generatedAt: candidate.generatedAt,
    directoryAsOf: candidate.directoryAsOf ?? '',
    sources: Array.isArray(candidate.sources) ? candidate.sources : [],
    institutions: candidate.institutions as Institution[],
  };
  if (dataset.institutions.length === 0) {
    throw new DataUnavailableError('The dataset contains no institutions.');
  }
  const duplicate = new Set<string>();
  for (const record of dataset.institutions) {
    if (duplicate.has(record.id)) throw new DataUnavailableError(`Duplicate institution id in dataset: ${record.id}`);
    duplicate.add(record.id);
  }

  let coverage: CoverageStats;
  try {
    coverage = JSON.parse(await readFile(path.join(dataDir, 'coverage.json'), 'utf8')) as CoverageStats;
    if (!coverage?.totals || !Array.isArray(coverage.countries)) throw new Error('bad coverage');
  } catch {
    coverage = buildCoverage({
      records: dataset.institutions,
      sources: dataset.sources,
      generatedAt: dataset.generatedAt,
      directoryAsOf: dataset.directoryAsOf,
      history: [],
    });
  }

  return new DataStore(dataset, coverage, dataDir);
}

export function verificationLabel(level: InstitutionVerification['level']): string {
  return level === 'source-checked' ? 'Source-checked' : 'Directory record';
}
