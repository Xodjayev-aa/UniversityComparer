import type {
  DeadlineFact,
  FeeFact,
  Institution,
  InstitutionSummary,
  SourceRef,
} from '../../shared/types';
import { institutionSchema } from '../../shared/schema';
import { buildCoverage } from '../../scripts/lib/coverage';
import { DataStore } from '../../server/data';

export const READ_DATE = '2026-10-17';

export function source(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    url: 'https://example.edu/fees',
    title: 'Example fees page',
    publisher: 'Example University',
    retrievedAt: READ_DATE,
    publishedAt: null,
    effectiveAt: '2026/27',
    license: null,
    ...overrides,
  };
}

export function fee(overrides: Partial<FeeFact> = {}): FeeFact {
  return {
    id: 'fee-one',
    label: 'International tuition',
    amount: { kind: 'exact', min: 20_000, max: 20_000, currency: 'GBP' },
    unit: 'per-year',
    coverage: 'tuition-only',
    academicYear: '2026/27',
    intake: 'Autumn 2026',
    applicantCategory: 'international',
    degreeLevel: 'bachelor',
    studyMode: 'full-time',
    campus: null,
    programId: null,
    notes: null,
    source: source(),
    verification: 'official-source-checked',
    ...overrides,
  };
}

export function deadline(overrides: Partial<DeadlineFact> = {}): DeadlineFact {
  return {
    id: 'deadline-one',
    date: '2027-01-15',
    dateText: '15 January 2027',
    intake: 'Autumn 2027',
    academicYear: '2027/28',
    applicantCategory: 'international',
    degreeLevel: 'bachelor',
    programId: null,
    notes: null,
    source: source({ url: 'https://example.edu/apply', title: 'Apply' }),
    verification: 'official-source-checked',
    ...overrides,
  };
}

export function institution(overrides: Partial<Institution> = {}): Institution {
  const base: Institution = {
    id: 'ror-example-one',
    rorId: 'https://ror.org/example1',
    domains: ['example.edu'],
    names: {
      primary: 'Example University One',
      official: 'Example University One',
      aliases: ['Example One'],
      localNames: [],
      formerNames: [],
    },
    country: { code: 'GB', name: 'United Kingdom' },
    region: 'Europe',
    locations: [
      {
        city: 'Oxford',
        region: 'England',
        countryCode: 'GB',
        countryName: 'United Kingdom',
        latitude: 51.75,
        longitude: -1.25,
        role: 'primary',
        source: 'ror',
      },
    ],
    website: 'https://example.edu/',
    kind: 'university',
    scope: 'university',
    listing: {
      hipo: true,
      ror: true,
      curated: true,
      scopeBasis: 'source-checked',
      basisNote: 'Fixture record.',
    },
    established: null,
    languages: ['en'],
    studyModes: ['full-time'],
    campuses: [],
    recognition: [
      {
        id: 'rec-one',
        body: 'Example Authority',
        bodyUrl: 'https://example.org/',
        scope: 'Example scope',
        status: 'listed',
        notes: null,
        source: source({ url: 'https://example.org/register', title: 'Register' }),
        verification: 'official-source-checked',
      },
    ],
    programs: [
      {
        id: 'prog-cs',
        name: 'Computer Science',
        degreeLevel: 'bachelor',
        subjectArea: 'computer-science',
        language: 'en',
        studyModes: ['full-time'],
        duration: '3 years',
        campus: null,
        faculty: null,
        admissionsUrl: 'https://example.edu/apply',
        source: source({ url: 'https://example.edu/cs', title: 'Computer Science' }),
        verification: 'official-source-checked',
        tuition: [fee({ id: 'prog-fee', programId: 'prog-cs' })],
        deadlines: [
          deadline({
            id: 'prog-deadline',
            date: '2026-10-15',
            dateText: '15 October 2026',
            intake: 'Autumn 2027',
            academicYear: '2027/28',
            programId: 'prog-cs',
          }),
        ],
        notes: null,
      },
    ],
    tuition: [
      fee({
        id: 'inst-fee',
        label: 'Institution-wide tuition',
        amount: { kind: 'exact', min: 25_000, max: 25_000, currency: 'GBP' },
      }),
    ],
    scholarships: [],
    admissions: {
      requirements: [],
      deadlines: [deadline({ id: 'inst-deadline' })],
      links: [
        {
          id: 'link-apply',
          label: 'Apply',
          kind: 'application',
          url: 'https://example.edu/apply',
          source: source({ url: 'https://example.edu/apply', title: 'Apply' }),
        },
      ],
    },
    verification: {
      level: 'source-checked',
      lastCheckedAt: READ_DATE,
      checkedFacts: 7,
      note: 'Fixture profile.',
    },
    sources: [
      source({ url: 'https://example.edu/', title: 'Home', publisher: 'Example University' }),
      source({ url: 'https://example.edu/fees', title: 'Fees' }),
      source({ url: 'https://example.edu/apply', title: 'Apply' }),
      source({ url: 'https://example.org/register', title: 'Register' }),
    ],
    dataNotes: [],
  };
  return institutionSchema.parse({ ...base, ...overrides }) as Institution;
}

export function directoryRecord(overrides: Partial<Institution> = {}): Institution {
  const base = institution({
    id: 'ror-montreal',
    rorId: 'https://ror.org/montreal',
    domains: ['umontreal.ca'],
    names: {
      primary: 'Université de Montréal',
      official: null,
      aliases: ['UdeM'],
      localNames: [],
      formerNames: [],
    },
    country: { code: 'CA', name: 'Canada' },
    region: 'Americas',
    locations: [
      {
        city: 'Montréal',
        region: 'Québec',
        countryCode: 'CA',
        countryName: 'Canada',
        latitude: 45.5,
        longitude: -73.6,
        role: 'primary',
        source: 'ror',
      },
    ],
    website: 'https://www.umontreal.ca/',
    kind: 'university',
    scope: 'university',
    listing: {
      hipo: true,
      ror: true,
      curated: false,
      scopeBasis: 'hipo-ror',
      basisNote: 'Directory-only fixture.',
    },
    recognition: [],
    programs: [],
    tuition: [],
    scholarships: [],
    admissions: { requirements: [], deadlines: [], links: [] },
    verification: { level: 'directory-only', lastCheckedAt: null, checkedFacts: 0, note: 'Directory only.' },
    sources: [source({ url: 'https://ror.org/montreal', title: 'ROR record' })],
    dataNotes: [],
  });
  return institutionSchema.parse({ ...base, ...overrides }) as Institution;
}

export const FIXTURE_INSTITUTIONS: Institution[] = [
  institution(),
  institution({
    id: 'ror-example-two',
    rorId: 'https://ror.org/example2',
    domains: ['example.ca'],
    names: {
      primary: 'Example University Two',
      official: null,
      aliases: [],
      localNames: [],
      formerNames: [],
    },
    country: { code: 'CA', name: 'Canada' },
    region: 'Americas',
    locations: [
      {
        city: 'Toronto',
        region: 'Ontario',
        countryCode: 'CA',
        countryName: 'Canada',
        latitude: 43.65,
        longitude: -79.38,
        role: 'primary',
        source: 'ror',
      },
    ],
    website: 'https://example.ca/',
    programs: [
      {
        id: 'prog-master',
        name: 'Computer Science (master)',
        degreeLevel: 'master',
        subjectArea: 'computer-science',
        language: 'fr',
        studyModes: ['part-time'],
        duration: '2 years',
        campus: 'Downtown',
        faculty: null,
        admissionsUrl: null,
        source: source({ url: 'https://example.ca/cs', title: 'Computer Science' }),
        verification: 'official-source-checked',
        tuition: [],
        deadlines: [],
        notes: null,
      },
    ],
    tuition: [],
    scholarships: [],
    admissions: {
      requirements: [],
      deadlines: [],
      links: [],
    },
    verification: {
      level: 'source-checked',
      lastCheckedAt: READ_DATE,
      checkedFacts: 2,
      note: 'Fixture profile with deliberately missing fee facts.',
    },
    sources: [source({ url: 'https://example.ca/', title: 'Home', publisher: 'Example Two' })],
  }),
  directoryRecord(),
  directoryRecord({
    id: 'ror-cairo',
    rorId: 'https://ror.org/cairo',
    domains: ['cu.edu.eg'],
    names: {
      primary: 'جامعة القاهرة',
      official: null,
      aliases: ['Cairo University'],
      localNames: [{ lang: 'ar', value: 'جامعة القاهرة', source: 'ror', type: 'label' }],
      formerNames: ['Egyptian University'],
    },
    country: { code: 'EG', name: 'Egypt' },
    region: 'Africa',
    locations: [
      {
        city: 'القاهرة',
        region: 'Cairo',
        countryCode: 'EG',
        countryName: 'Egypt',
        latitude: 30.0,
        longitude: 31.2,
        role: 'primary',
        source: 'ror',
      },
    ],
    website: 'https://cu.edu.eg/',
    sources: [source({ url: 'https://ror.org/cairo', title: 'ROR record' })],
  }),
  directoryRecord({
    id: 'dir-seminary',
    rorId: null,
    domains: [],
    names: {
      primary: 'Example Baptist Seminary',
      official: null,
      aliases: [],
      localNames: [],
      formerNames: [],
    },
    country: { code: 'US', name: 'United States' },
    region: 'Americas',
    locations: [
      {
        city: 'Boston',
        region: 'Massachusetts',
        countryCode: 'US',
        countryName: 'United States',
        latitude: null,
        longitude: null,
        role: 'primary',
        source: 'hipo',
      },
    ],
    website: null,
    kind: 'not-classified',
    scope: 'education',
    listing: {
      hipo: true,
      ror: false,
      curated: false,
      scopeBasis: 'hipo-directory',
      basisNote: 'Broader education scope fixture.',
    },
    sources: [source({ url: 'https://github.com/Hipo/university-domains-list', title: 'Hipo directory' })],
  }),
];

export function fixtureSummary(record: Institution): InstitutionSummary {
  return {
    id: record.id,
    name: record.names.primary,
    country: record.country,
    region: record.region,
    city: record.locations.find((location) => location.city)?.city ?? null,
    website: record.website,
    scope: record.scope,
    listing: record.listing,
    verificationLevel: record.verification.level,
    programs: {
      count: record.programs.length,
      degreeLevels: [...new Set(record.programs.map((program) => program.degreeLevel))],
      languages: [...new Set(record.programs.map((program) => program.language).filter((v): v is string => Boolean(v)))],
      subjects: [...new Set(record.programs.map((program) => program.subjectArea))],
    },
    hasFeeFacts: record.tuition.length > 0 || record.programs.some((program) => program.tuition.length > 0),
    hasRecognition: record.recognition.length > 0,
    matchedOn: null,
  };
}

export function makeFixtureStore(records: Institution[] = FIXTURE_INSTITUTIONS): DataStore {
  const coverage = buildCoverage({
    records,
    sources: [],
    generatedAt: '2026-10-17T00:00:00.000Z',
    directoryAsOf: '2026-10-06',
    history: [],
  });
  return new DataStore(
    {
      schemaVersion: 1,
      generatedAt: '2026-10-17T00:00:00.000Z',
      directoryAsOf: '2026-10-06',
      sources: [],
      institutions: records,
    },
    coverage,
    'fixtures',
  );
}
