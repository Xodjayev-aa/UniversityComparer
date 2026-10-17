import { describe, expect, it } from 'vitest';
import { researchFileSchema, type ResearchFileInput } from '../../shared/schema';
import { applyResearchFiles } from '../../scripts/ingest/research';
import { institution } from '../helpers/fixtures';

function researchFile(overrides: Record<string, unknown> = {}): ResearchFileInput {
  return researchFileSchema.parse({
    schemaVersion: 1,
    key: 'example-university',
    profileSource: 'home',
    match: {
      rorId: 'https://ror.org/example1',
      domains: ['example.edu'],
      name: 'Example University One',
      countryCode: 'GB',
    },
    names: {
      primary: 'Example University One',
      official: 'Example University One',
      aliases: ['Example One'],
      localNames: [{ lang: 'cy', value: 'Prifysgol Enghreifftiol', type: 'label' }],
      formerNames: [],
    },
    website: 'https://example.edu/',
    kind: 'university',
    programs: [
      {
        id: 'ex-cs',
        name: 'Computer Science',
        degreeLevel: 'bachelor',
        subjectArea: 'computer-science',
        language: 'en',
        studyModes: ['full-time'],
        duration: '3 years',
        source: 'program',
        tuition: [
          {
            label: 'International tuition',
            amount: { kind: 'exact', min: 21_000, max: 21_000, currency: 'GBP' },
            unit: 'per-year',
            coverage: 'tuition-only',
            academicYear: '2027/28',
            applicantCategory: 'international',
            source: 'fees',
          },
        ],
        deadlines: [],
      },
    ],
    tuition: [
      {
        label: 'Home tuition',
        amount: { kind: 'exact', min: 9_000, max: 9_000, currency: 'GBP' },
        unit: 'per-year',
        coverage: 'tuition-only',
        academicYear: '2027/28',
        applicantCategory: 'home',
        degreeLevel: 'bachelor',
        source: 'fees',
      },
    ],
    admissions: {
      links: [
        {
          label: 'Apply',
          kind: 'application',
          url: 'https://example.edu/apply',
          source: 'program',
        },
      ],
    },
    dataNotes: ['Read for 2027 entry.'],
    sources: {
      home: {
        url: 'https://example.edu/',
        title: 'Example University',
        publisher: 'Example University',
        retrievedAt: '2026-10-17',
      },
      program: {
        url: 'https://example.edu/cs',
        title: 'Computer Science',
        publisher: 'Example University',
        retrievedAt: '2026-10-16',
      },
      fees: {
        url: 'https://example.edu/fees',
        title: 'Fees',
        publisher: 'Example University',
        retrievedAt: '2026-10-15',
      },
    },
    ...overrides,
  });
}

describe('research file validation', () => {
  it('rejects a source key that is defined but unused', () => {
    const parsed = researchFileSchema.safeParse({
      ...researchFile(),
      sources: {
        ...researchFile().sources,
        extra: {
          url: 'https://example.edu/extra',
          title: 'Extra',
          publisher: 'Example University',
          retrievedAt: '2026-10-17',
        },
      },
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((issue) => /listed but not used/i.test(issue.message))).toBe(true);
  });

  it('rejects an unknown source key and a future read date', () => {
    const unknown = researchFileSchema.safeParse({
      ...researchFile(),
      dataNotes: [],
      profileSource: 'missing',
    });
    expect(unknown.success).toBe(false);

    const future = researchFileSchema.safeParse({
      ...researchFile(),
      sources: {
        ...researchFile().sources,
        home: { ...researchFile().sources.home!, retrievedAt: '2999-01-01' },
      },
    });
    expect(future.success).toBe(false);
    expect(future.error?.issues.some((issue) => /future/i.test(issue.message))).toBe(true);
  });

  it('rejects an institution-wide fee without a degree level', () => {
    const noDegree = researchFile();
    const fee = { ...(noDegree.tuition[0] as Record<string, unknown>) };
    delete fee.degreeLevel;
    expect(() =>
      applyResearchFiles([institution()], [researchFile({ tuition: [fee] })]),
    ).toThrow(/degreeLevel/);
  });
});

describe('applying a research file', () => {
  it('replaces directory facts with only the reviewed ones and records the latest read date', () => {
    const directory = institution({
      recognition: [],
      programs: [],
      tuition: [],
      admissions: { requirements: [], deadlines: [], links: [] },
      listing: {
        hipo: true,
        ror: true,
        curated: false,
        scopeBasis: 'hipo-ror',
        basisNote: 'Directory listing.',
      },
      verification: { level: 'directory-only', lastCheckedAt: null, checkedFacts: 0, note: 'Not read.' },
    });
    const result = applyResearchFiles([directory], [researchFile()]);
    expect(result.profiles).toBe(1);
    expect(result.warnings).toEqual([]);
    const [record] = result.records;
    expect(record?.verification.level).toBe('source-checked');
    expect(record?.verification.lastCheckedAt).toBe('2026-10-17');
    expect(record?.listing.curated).toBe(true);
    expect(record?.listing.scopeBasis).toBe('source-checked');
    expect(record?.programs).toHaveLength(1);
    expect(record?.programs[0]?.tuition[0]?.academicYear).toBe('2027/28');
    expect(record?.programs[0]?.tuition[0]?.programId).toBe('ex-cs');
    expect(record?.tuition[0]?.degreeLevel).toBe('bachelor');
    expect(record?.dataNotes).toContain('Read for 2027 entry.');
    expect(record?.verification.note).toMatch(/not a guarantee of currentness/i);
  });

  it('deduplicates aliases and local names instead of repeating them', () => {
    const directory = institution();
    const result = applyResearchFiles([directory], [researchFile()]);
    const names = result.records[0]!.names;
    expect(names.aliases.filter((alias) => alias === 'Example One')).toHaveLength(1);
    expect(new Set(names.localNames.map((name) => name.value)).size).toBe(names.localNames.length);
  });

  it('refuses a missing match rather than guessing', () => {
    const other = institution({
      id: 'ror-example-other',
      rorId: 'https://ror.org/other',
      domains: ['other.edu'],
      names: {
        primary: 'Completely Different College',
        official: null,
        aliases: [],
        localNames: [],
        formerNames: [],
      },
      country: { code: 'GB', name: 'United Kingdom' },
    });
    expect(() => applyResearchFiles([other], [researchFile()])).toThrow(/no directory record matched/i);
  });

  it('refuses two same-named candidates in the same country as ambiguous', () => {
    const twinA = institution({ id: 'ror-twin-a', rorId: 'https://ror.org/twin-a', domains: ['a.example.edu'] });
    const twinB = institution({ id: 'ror-twin-b', rorId: 'https://ror.org/twin-b', domains: ['b.example.edu'] });
    expect(() => applyResearchFiles([twinA, twinB], [researchFile()])).toThrow(/ambiguous directory match/i);
  });

  it('refuses two research files that target the same institution', () => {
    const second = researchFile({
      key: 'example-two',
      match: { name: 'Example University One', countryCode: 'GB', domains: [], rorId: null },
    });
    expect(() => applyResearchFiles([institution()], [researchFile(), second])).toThrow(
      /more than one research file/i,
    );
  });

  it('builds a standalone profile only when the institution is deliberately absent', () => {
    const absent = researchFile({
      allowUnmatched: true,
      match: { name: 'Nowhere University', countryCode: 'GB', domains: ['nowhere.example.ac.uk'], rorId: null },
      key: 'nowhere-university',
    });
    const result = applyResearchFiles([], [absent]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.listing.ror).toBe(false);
    expect(result.records[0]?.listing.curated).toBe(true);
    expect(result.records[0]?.verification.level).toBe('source-checked');
    expect(result.records[0]?.dataNotes.join(' ')).toMatch(/not present in the directory/i);
  });
});
