import { z } from 'zod';
import { SUBJECT_IDS } from './taxonomy.js';
import type { Institution } from './types.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid calendar date');

export const httpUrlSchema = z.string().min(1).max(800).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, 'Use an absolute http(s) URL');

export const sourceRefSchema = z.object({
  url: httpUrlSchema,
  title: z.string().min(1).max(300),
  publisher: z.string().min(1).max(200),
  retrievedAt: isoDate,
  publishedAt: isoDate.nullable(),
  effectiveAt: z.string().max(100).nullable(),
  license: z.string().max(120).nullable(),
});

const currency = z.string().regex(/^[A-Z]{3}$/, 'Use an uppercase ISO 4217 currency code');

export const feeAmountSchema = z
  .object({
    kind: z.enum(['exact', 'range']),
    min: z.number().positive().finite(),
    max: z.number().positive().finite().nullable(),
    currency,
  })
  .superRefine((amount, ctx) => {
    if (amount.kind === 'exact' && amount.max !== amount.min) {
      ctx.addIssue({ code: 'custom', message: 'An exact amount must have min = max' });
    }
    if (amount.kind === 'range') {
      if (amount.max === null) {
        ctx.addIssue({ code: 'custom', message: 'A range amount needs a maximum' });
      } else if (amount.max < amount.min) {
        ctx.addIssue({ code: 'custom', message: 'The range maximum must be ≥ the minimum' });
      }
    }
  });

export const applicantCategorySchema = z.enum([
  'all',
  'international',
  'domestic',
  'home',
  'eu-eea',
  'in-state',
  'out-of-state',
  'other',
]);

export const degreeLevelSchema = z.enum(['bachelor', 'master', 'doctorate', 'non-degree']);
export const studyModeSchema = z.enum(['full-time', 'part-time']);
export const feeUnitSchema = z.enum([
  'per-year',
  'per-semester',
  'per-term',
  'per-credit',
  'total-program',
  'per-month',
]);
export const feeCoverageSchema = z.enum([
  'tuition-only',
  'including-mandatory-fees',
  'mandatory-fees-separate',
  'unclear',
]);

export const feeFactSchema = z.object({
  id: z.string().min(3).max(100),
  label: z.string().min(1).max(160),
  amount: feeAmountSchema,
  unit: feeUnitSchema,
  coverage: feeCoverageSchema,
  academicYear: z.string().min(1).max(30),
  intake: z.string().max(80).nullable(),
  applicantCategory: applicantCategorySchema,
  degreeLevel: degreeLevelSchema,
  studyMode: studyModeSchema.nullable(),
  campus: z.string().max(160).nullable(),
  programId: z.string().max(100).nullable(),
  notes: z.string().max(600).nullable(),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const deadlineFactSchema = z.object({
  id: z.string().min(3).max(100),
  date: isoDate.nullable(),
  dateText: z.string().min(1).max(200),
  intake: z.string().min(1).max(80),
  academicYear: z.string().min(1).max(30),
  applicantCategory: applicantCategorySchema,
  degreeLevel: degreeLevelSchema,
  programId: z.string().max(100).nullable(),
  notes: z.string().max(600).nullable(),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const programSchema = z.object({
  id: z.string().min(3).max(100),
  name: z.string().min(1).max(240),
  degreeLevel: degreeLevelSchema,
  subjectArea: z.enum(SUBJECT_IDS as [string, ...string[]]),
  language: z.string().min(2).max(20).nullable(),
  studyModes: z.array(studyModeSchema).max(2),
  duration: z.string().max(120).nullable(),
  campus: z.string().max(160).nullable(),
  faculty: z.string().max(160).nullable(),
  admissionsUrl: httpUrlSchema.nullable(),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
  tuition: z.array(feeFactSchema).max(24),
  deadlines: z.array(deadlineFactSchema).max(12),
  notes: z.string().max(600).nullable(),
});

export const recognitionSchema = z.object({
  id: z.string().min(3).max(100),
  body: z.string().min(1).max(200),
  bodyUrl: httpUrlSchema.nullable(),
  scope: z.string().min(1).max(200),
  status: z.enum(['accredited', 'recognised', 'approved', 'listed', 'not-stated']),
  notes: z.string().max(600).nullable(),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const scholarshipSchema = z.object({
  id: z.string().min(3).max(100),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1200),
  amountText: z.string().max(200).nullable(),
  audience: z.string().max(200).nullable(),
  url: httpUrlSchema,
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const admissionRequirementSchema = z.object({
  id: z.string().min(3).max(100),
  text: z.string().min(1).max(1000),
  degreeLevel: degreeLevelSchema,
  applicantCategory: applicantCategorySchema,
  academicYear: z.string().min(1).max(30),
  intake: z.string().max(80).nullable(),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const officialLinkSchema = z.object({
  id: z.string().min(3).max(100),
  label: z.string().min(1).max(120),
  kind: z.enum([
    'admissions',
    'programs',
    'fees',
    'scholarships',
    'international',
    'application',
    'recognition',
    'other',
  ]),
  url: httpUrlSchema,
  source: sourceRefSchema,
});

export const campusSchema = z.object({
  id: z.string().min(3).max(100),
  name: z.string().min(1).max(200),
  city: z.string().max(160).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  source: sourceRefSchema,
  verification: z.enum(['official-source-checked', 'needs-verification']),
});

export const locationSchema = z.object({
  city: z.string().max(160).nullable(),
  region: z.string().max(160).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  countryName: z.string().min(1).max(160),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  role: z.enum(['primary', 'additional']),
  source: z.enum(['ror', 'hipo', 'official']),
});

export const institutionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{3,90}$/, 'Institution ids use lowercase letters, digits and dashes'),
    rorId: httpUrlSchema.nullable(),
    domains: z.array(z.string().min(3).max(200)).max(20),
    names: z.object({
      primary: z.string().min(1).max(300),
      official: z.string().max(300).nullable(),
      aliases: z.array(z.string().min(1).max(300)).max(40),
      localNames: z
        .array(
          z.object({
            lang: z.string().min(2).max(20),
            value: z.string().min(1).max(300),
            source: z.enum(['ror', 'hipo', 'official']),
            type: z.string().max(40),
          }),
        )
        .max(40),
      formerNames: z.array(z.string().min(1).max(300)).max(20),
    }),
    country: z.object({ code: z.string().regex(/^[A-Z]{2}$/), name: z.string().min(1) }),
    region: z.enum(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Other']),
    locations: z.array(locationSchema).max(8),
    website: httpUrlSchema.nullable(),
    kind: z.enum(['university', 'technical-university', 'college', 'institute', 'academy', 'not-classified']),
    scope: z.enum(['university', 'education']),
    listing: z.object({
      hipo: z.boolean(),
      ror: z.boolean(),
      curated: z.boolean(),
      scopeBasis: z.enum([
        'university-name-heuristic',
        'ror-education',
        'hipo-directory',
        'hipo-ror',
        'source-checked',
      ]),
      basisNote: z.string().min(1).max(400),
    }),
    established: z.number().int().min(500).max(2200).nullable(),
    languages: z.array(z.string().min(2).max(20)).max(30),
    studyModes: z.array(studyModeSchema).max(2),
    campuses: z.array(campusSchema).max(20),
    recognition: z.array(recognitionSchema).max(20),
    programs: z.array(programSchema).max(300),
    tuition: z.array(feeFactSchema).max(60),
    scholarships: z.array(scholarshipSchema).max(30),
    admissions: z.object({
      requirements: z.array(admissionRequirementSchema).max(30),
      deadlines: z.array(deadlineFactSchema).max(30),
      links: z.array(officialLinkSchema).max(30),
    }),
    verification: z.object({
      level: z.enum(['source-checked', 'directory-only']),
      lastCheckedAt: isoDate.nullable(),
      checkedFacts: z.number().int().min(0).max(5000),
      note: z.string().min(1).max(600),
    }),
    sources: z.array(sourceRefSchema).max(120),
    dataNotes: z.array(z.string().min(1).max(600)).max(20),
  })
  .superRefine((institution, ctx) => {
    const factArrays = [
      institution.tuition,
      institution.admissions.deadlines,
      institution.admissions.requirements,
      institution.recognition,
      institution.scholarships,
      institution.programs,
      institution.campuses,
    ];
    const hasFacts =
      factArrays.some((items) => items.length > 0) ||
      institution.programs.some(
        (program) => program.tuition.length > 0 || program.deadlines.length > 0,
      ) ||
      institution.admissions.links.length > 0;
    if (institution.verification.level === 'directory-only' && hasFacts) {
      ctx.addIssue({
        code: 'custom',
        message: 'Directory-only records may not carry researched facts',
        path: ['verification', 'level'],
      });
    }
    if (institution.verification.level === 'source-checked' && !institution.verification.lastCheckedAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Source-checked profiles need a lastCheckedAt date',
        path: ['verification', 'lastCheckedAt'],
      });
    }
    const ids = new Set<string>();
    const checkId = (id: string, path: (string | number)[]) => {
      if (ids.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate id: ${id}`, path });
      ids.add(id);
    };
    institution.programs.forEach((program, index) => {
      checkId(program.id, ['programs', index, 'id']);
      program.tuition.forEach((fee, feeIndex) => {
        checkId(fee.id, ['programs', index, 'tuition', feeIndex, 'id']);
        if (fee.programId !== program.id) {
          ctx.addIssue({
            code: 'custom',
            message: 'A programme fee must reference its enclosing programme',
            path: ['programs', index, 'tuition', feeIndex, 'programId'],
          });
        }
      });
      program.deadlines.forEach((deadline, deadlineIndex) => {
        checkId(deadline.id, ['programs', index, 'deadlines', deadlineIndex, 'id']);
        if (deadline.programId !== program.id) {
          ctx.addIssue({
            code: 'custom',
            message: 'A programme deadline must reference its enclosing programme',
            path: ['programs', index, 'deadlines', deadlineIndex, 'programId'],
          });
        }
      });
    });
    institution.tuition.forEach((fee, index) => checkId(fee.id, ['tuition', index, 'id']));
    institution.admissions.deadlines.forEach((deadline, index) =>
      checkId(deadline.id, ['admissions', 'deadlines', index, 'id']),
    );
    institution.admissions.requirements.forEach((requirement, index) =>
      checkId(requirement.id, ['admissions', 'requirements', index, 'id']),
    );
    institution.recognition.forEach((entry, index) => checkId(entry.id, ['recognition', index, 'id']));
    institution.scholarships.forEach((entry, index) => checkId(entry.id, ['scholarships', index, 'id']));
    institution.campuses.forEach((entry, index) => checkId(entry.id, ['campuses', index, 'id']));
  });

export const institutionDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime({ offset: true }),
    directoryAsOf: isoDate,
    sources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        publisher: z.string(),
        url: httpUrlSchema,
        license: z.string(),
        licenseUrl: httpUrlSchema,
        retrievedAt: isoDate,
        release: z.string().nullable(),
        use: z.string(),
        limitations: z.string(),
      }),
    ),
    institutions: z.array(institutionSchema),
  })
  .superRefine((dataset, ctx) => {
    const ids = new Set<string>();
    dataset.institutions.forEach((institution, index) => {
      if (ids.has(institution.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate institution id: ${institution.id}`, path: ['institutions', index, 'id'] });
      }
      ids.add(institution.id);
    });
  });

export type ValidatedDataset = z.infer<typeof institutionDatasetSchema>;

/* ------------------------------------------------------------------ *
 * Research-file schema (human-authored, compact source-key form).
 * ------------------------------------------------------------------ */

const sourceInputSchema = z.object({
  url: httpUrlSchema,
  title: z.string().min(1).max(300),
  publisher: z.string().min(1).max(200),
  retrievedAt: isoDate,
  publishedAt: isoDate.nullish(),
  effectiveAt: z.string().max(100).nullish(),
  license: z.string().max(120).nullish(),
});

const compactFeeSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  label: z.string().min(1).max(160),
  amount: feeAmountSchema,
  unit: feeUnitSchema,
  coverage: feeCoverageSchema,
  academicYear: z.string().min(1).max(30),
  intake: z.string().max(80).nullish(),
  applicantCategory: applicantCategorySchema,
  /** Required for institution-wide fees; ignored (and checked) on programme fees. */
  degreeLevel: degreeLevelSchema.optional(),
  studyMode: studyModeSchema.nullish(),
  campus: z.string().max(160).nullish(),
  notes: z.string().max(600).nullish(),
  source: z.string().min(1),
});

const compactDeadlineSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  date: isoDate.nullish(),
  dateText: z.string().min(1).max(200),
  intake: z.string().min(1).max(80),
  academicYear: z.string().min(1).max(30),
  applicantCategory: applicantCategorySchema,
  /** Required for institution-wide deadlines; ignored (and checked) on programme deadlines. */
  degreeLevel: degreeLevelSchema.optional(),
  notes: z.string().max(600).nullish(),
  source: z.string().min(1),
});

const compactProgramSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  name: z.string().min(1).max(240),
  degreeLevel: degreeLevelSchema,
  subjectArea: z.enum(SUBJECT_IDS as [string, ...string[]]),
  language: z.string().min(2).max(20).nullish(),
  studyModes: z.array(studyModeSchema).max(2).default([]),
  duration: z.string().max(120).nullish(),
  campus: z.string().max(160).nullish(),
  faculty: z.string().max(160).nullish(),
  admissionsUrl: httpUrlSchema.nullish(),
  source: z.string().min(1),
  notes: z.string().max(600).nullish(),
  tuition: z.array(compactFeeSchema).max(24).default([]),
  deadlines: z.array(compactDeadlineSchema).max(12).default([]),
});

const compactRecognitionSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  body: z.string().min(1).max(200),
  bodyUrl: httpUrlSchema.nullish(),
  scope: z.string().min(1).max(200),
  status: z.enum(['accredited', 'recognised', 'approved', 'listed', 'not-stated']),
  notes: z.string().max(600).nullish(),
  source: z.string().min(1),
});

const compactRequirementSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  text: z.string().min(1).max(1000),
  degreeLevel: degreeLevelSchema,
  applicantCategory: applicantCategorySchema,
  academicYear: z.string().min(1).max(30),
  intake: z.string().max(80).nullish(),
  source: z.string().min(1),
});

const compactLinkSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  label: z.string().min(1).max(120),
  kind: z.enum([
    'admissions',
    'programs',
    'fees',
    'scholarships',
    'international',
    'application',
    'recognition',
    'other',
  ]),
  url: httpUrlSchema,
  source: z.string().min(1),
});

export const researchFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    key: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use a lowercase key for the profile'),
    /** Source key used for identity (name, website, location) claims. */
    profileSource: z.string().min(1),
    match: z.object({
      rorId: httpUrlSchema.nullish(),
      domains: z.array(z.string().min(3).max(200)).max(10).default([]),
      name: z.string().min(1).max(300),
      countryCode: z.string().regex(/^[A-Z]{2}$/),
    }),
    names: z
      .object({
        primary: z.string().min(1).max(300).optional(),
        official: z.string().min(1).max(300).nullish(),
        aliases: z.array(z.string().min(1).max(300)).max(20).default([]),
        localNames: z
          .array(
            z.object({
              lang: z.string().min(2).max(20),
              value: z.string().min(1).max(300),
              type: z.string().max(40).default('official'),
            }),
          )
          .max(20)
          .default([]),
        formerNames: z.array(z.string().min(1).max(300)).max(10).default([]),
      })
      .default(() => ({ aliases: [], localNames: [], formerNames: [] })),
    website: httpUrlSchema.nullish(),
    kind: z
      .enum(['university', 'technical-university', 'college', 'institute', 'academy', 'not-classified'])
      .optional(),
    established: z.number().int().min(500).max(2200).nullish(),
    languages: z.array(z.string().min(2).max(20)).max(30).default([]),
    studyModes: z.array(studyModeSchema).max(2).default([]),
    campuses: z
      .array(
        z.object({
          id: z.string().min(3).max(100).optional(),
          name: z.string().min(1).max(200),
          city: z.string().max(160).nullish(),
          countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
          source: z.string().min(1),
        }),
      )
      .max(20)
      .default([]),
    recognition: z.array(compactRecognitionSchema).max(20).default([]),
    programs: z.array(compactProgramSchema).max(300).default([]),
    tuition: z.array(compactFeeSchema).max(60).default([]),
    scholarships: z
      .array(
        z.object({
          id: z.string().min(3).max(100).optional(),
          name: z.string().min(1).max(200),
          description: z.string().min(1).max(1200),
          amountText: z.string().max(200).nullish(),
          audience: z.string().max(200).nullish(),
          url: httpUrlSchema,
          source: z.string().min(1),
        }),
      )
      .max(30)
      .default([]),
    admissions: z
      .object({
        requirements: z.array(compactRequirementSchema).max(30).default([]),
        deadlines: z.array(compactDeadlineSchema).max(30).default([]),
        links: z.array(compactLinkSchema).max(30).default([]),
      })
      .default(() => ({ requirements: [], deadlines: [], links: [] })),
    dataNotes: z.array(z.string().min(1).max(600)).max(20).default([]),
    sources: z.record(z.string().min(1).max(60), sourceInputSchema),
    /** Set only when the institution deliberately has no directory record. */
    allowUnmatched: z.boolean().default(false),
  })
  .superRefine((research, ctx) => {
    if (!research.sources[research.profileSource]) {
      ctx.addIssue({
        code: 'custom',
        message: `profileSource “${research.profileSource}” is not defined in sources`,
        path: ['profileSource'],
      });
    }
    const used = new Set<string>();
    const checkSource = (key: string, path: (string | number)[]) => {
      used.add(key);
      if (!research.sources[key]) {
        ctx.addIssue({ code: 'custom', message: `Unknown source key “${key}”`, path });
      }
    };
    checkSource(research.profileSource, ['profileSource']);
    research.campuses.forEach((campus, index) => checkSource(campus.source, ['campuses', index, 'source']));
    research.recognition.forEach((entry, index) => checkSource(entry.source, ['recognition', index, 'source']));
    research.tuition.forEach((fee, index) => checkSource(fee.source, ['tuition', index, 'source']));
    research.admissions.requirements.forEach((entry, index) =>
      checkSource(entry.source, ['admissions', 'requirements', index, 'source']),
    );
    research.admissions.deadlines.forEach((entry, index) =>
      checkSource(entry.source, ['admissions', 'deadlines', index, 'source']),
    );
    research.admissions.links.forEach((entry, index) =>
      checkSource(entry.source, ['admissions', 'links', index, 'source']),
    );
    research.scholarships.forEach((entry, index) => checkSource(entry.source, ['scholarships', index, 'source']));
    research.programs.forEach((program, index) => {
      checkSource(program.source, ['programs', index, 'source']);
      program.tuition.forEach((fee, feeIndex) =>
        checkSource(fee.source, ['programs', index, 'tuition', feeIndex, 'source']),
      );
      program.deadlines.forEach((deadline, deadlineIndex) =>
        checkSource(deadline.source, ['programs', index, 'deadlines', deadlineIndex, 'source']),
      );
    });
    for (const key of Object.keys(research.sources)) {
      if (!used.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Source “${key}” is listed but not used by any fact`,
          path: ['sources', key],
        });
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const [key, source] of Object.entries(research.sources)) {
      if (source.retrievedAt > today) {
        ctx.addIssue({
          code: 'custom',
          message: `Source “${key}” has a future retrievedAt date`,
          path: ['sources', key, 'retrievedAt'],
        });
      }
    }
  });

export type ResearchFileInput = z.infer<typeof researchFileSchema>;

/** Runtime guard for anything read from disk before it is trusted. */
export function parseInstitutionDataset(value: unknown): Institution[] {
  return institutionDatasetSchema.parse(value).institutions as Institution[];
}
