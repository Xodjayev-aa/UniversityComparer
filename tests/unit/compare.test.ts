import { describe, expect, it } from 'vitest';
import { bestFee, compareInstitutions, DEFAULT_COMPARE_OPTIONS } from '../../src/lib/compare';
import { fee, institution } from '../helpers/fixtures';

const one = institution();
const two = institution({
  id: 'ror-example-two',
  rorId: 'https://ror.org/example2',
  names: { primary: 'Example University Two', official: null, aliases: [], localNames: [], formerNames: [] },
  country: { code: 'CA', name: 'Canada' },
  region: 'Americas',
  programs: [],
  tuition: [],
  recognition: [],
  admissions: { requirements: [], deadlines: [], links: [] },
});

function cheap(overrides: Partial<Parameters<typeof institution>[0]> = {}) {
  return institution({
    id: 'ror-cheap',
    rorId: 'https://ror.org/cheap',
    names: { primary: 'Cheap Example University', official: null, aliases: [], localNames: [], formerNames: [] },
    tuition: [
      fee({
        id: 'cheap-fee',
        amount: { kind: 'exact', min: 5_000, max: 5_000, currency: 'GBP' },
      }),
    ],
    recognition: [],
    programs: [
      {
        id: 'cheap-cs',
        name: 'Computer Science',
        degreeLevel: 'bachelor',
        subjectArea: 'computer-science',
        language: 'en',
        studyModes: ['full-time'],
        duration: '3 years',
        campus: null,
        faculty: null,
        admissionsUrl: null,
        source: institution().programs[0]!.source,
        verification: 'official-source-checked',
        tuition: [],
        deadlines: [],
        notes: null,
      },
    ],
    ...overrides,
  });
}

describe('fee selection', () => {
  it('prefers an institution-wide fact when no subject is chosen', () => {
    const choice = bestFee(one, { ...DEFAULT_COMPARE_OPTIONS, degree: 'bachelor' });
    expect(choice.choice?.program).toBeNull();
    expect(choice.choice?.fee.amount.min).toBe(25_000);
  });

  it('prefers a matching programme fact when a subject is chosen', () => {
    const choice = bestFee(one, { ...DEFAULT_COMPARE_OPTIONS, degree: 'bachelor', subject: 'computer-science' });
    expect(choice.choice?.program?.id).toBe('prog-cs');
    expect(choice.choice?.fee.amount.min).toBe(20_000);
  });

  it('respects the applicant category and does not fall back to another category', () => {
    const choice = bestFee(one, { ...DEFAULT_COMPARE_OPTIONS, degree: 'bachelor', applicantCategory: 'domestic' });
    expect(choice.choice).toBeNull();
    expect(choice.reason).toContain('domestic');
  });
});

describe('comparison with missing data', () => {
  it('refuses a cost ranking unless two like-for-like fees exist', () => {
    const result = compareInstitutions([one, two], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'cost',
    });
    expect(result.dimensions.cost.available).toBe(false);
    expect(result.outcome.kind).toBe('insufficient');
    expect(result.evaluations.find((evaluation) => evaluation.id === 'ror-example-two')?.selectedFee).toBeNull();
    expect(result.gaps.join(' ')).toMatch(/Missing fee data is not treated as expensive or cheap/);
  });

  it('does not rank fees across currencies without a dated exchange rate', () => {
    const usd = cheap({
      tuition: [
        fee({
          id: 'cheap-fee',
          amount: { kind: 'exact', min: 5_000, max: 5_000, currency: 'USD' },
        }),
      ],
    });
    const result = compareInstitutions([one, usd], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'cost',
    });
    expect(result.dimensions.cost.available).toBe(false);
    expect(result.outcome.kind).toBe('insufficient');
    expect(result.gaps.join(' ')).toMatch(/No exchange rate/i);
  });

  it('does not rank different academic years as like-for-like', () => {
    const otherYear = cheap({
      tuition: [
        fee({
          id: 'cheap-fee',
          academicYear: '2027/28',
          amount: { kind: 'exact', min: 5_000, max: 5_000, currency: 'GBP' },
        }),
      ],
    });
    const result = compareInstitutions([one, otherYear], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'cost',
    });
    expect(result.dimensions.cost.available).toBe(false);
    expect(result.gaps.join(' ')).toMatch(/different academic years/i);
  });

  it('recommends only when two institutions have comparable fees in one currency and year', () => {
    const result = compareInstitutions([one, cheap()], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'cost',
    });
    expect(result.dimensions.cost.available).toBe(true);
    expect(result.outcome.kind).toBe('recommendation');
    expect(result.outcome.recommendedIds).toEqual(['ror-cheap']);
    expect(result.outcome.title).toContain('Cheap Example University');
  });

  it('treats a missing programme catalogue as unknown, not as "not offered"', () => {
    const result = compareInstitutions([one, two], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'subject',
      subject: 'computer-science',
      requireProgram: true,
    });
    const missing = result.evaluations.find((evaluation) => evaluation.id === 'ror-example-two');
    expect(missing?.programData).toBe('unavailable');
    expect(missing?.hardUnknowns.join(' ')).toMatch(/not available/i);
    expect(missing?.rankable).toBe(false);
    expect(result.outcome.kind).toBe('insufficient');
  });

  it('states that no reliable overall recommendation is possible when only one fee is available', () => {
    const result = compareInstitutions([one], {
      degree: 'bachelor',
      applicantCategory: 'international',
      priority: 'balanced',
    });
    expect(result.outcome.kind).toBe('insufficient');
    expect(result.outcome.title).toMatch(/No reliable overall recommendation/);
  });
});

describe('hard requirements', () => {
  it('removes an institution without fee data when fee data is required', () => {
    const result = compareInstitutions([one, two], {
      degree: 'bachelor',
      applicantCategory: 'international',
      requireSourceChecked: true,
      requireFeeData: true,
      priority: 'cost',
    });
    expect(result.evaluations.find((evaluation) => evaluation.id === 'ror-example-two')?.hardFailures).toContain(
      'No source-checked fee data.',
    );
  });

  it('requires a selected filter before applying a programme requirement', () => {
    const result = compareInstitutions([one, two], {
      degree: '',
      subject: '',
      requireProgram: true,
      priority: 'balanced',
    });
    expect(result.evaluations.every((evaluation) => evaluation.hardUnknowns.length === 0)).toBe(true);
  });
});
