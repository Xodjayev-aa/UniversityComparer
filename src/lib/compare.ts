import type {
  ApplicantCategory,
  DegreeLevel,
  FeeFact,
  Institution,
  Program,
} from '../../shared/types';
import { DEGREE_LABELS, APPLICANT_LABELS, FEE_COVERAGE_LABELS, FEE_UNIT_LABELS, subjectLabel } from '../../shared/taxonomy';
import { feeAmountForSort, formatFeeAmount, formatDate } from './format';

export type ComparePriority = 'balanced' | 'cost' | 'subject' | 'location';

export interface CompareOptions {
  priority: ComparePriority;
  subject: string;
  degree: DegreeLevel | '';
  applicantCategory: ApplicantCategory;
  countryPreference: string;
  languagePreference: string;
  requireProgram: boolean;
  requireCountry: boolean;
  requireSourceChecked: boolean;
  requireFeeData: boolean;
}

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  priority: 'balanced',
  subject: '',
  degree: '',
  applicantCategory: 'international',
  countryPreference: '',
  languagePreference: '',
  requireProgram: false,
  requireCountry: false,
  requireSourceChecked: false,
  requireFeeData: false,
};

interface FeeChoice {
  fee: FeeFact;
  program: Program | null;
}

export interface Evaluation {
  id: string;
  name: string;
  institution: Institution;
  matchingPrograms: Program[];
  programData: 'available' | 'none-listed' | 'unavailable';
  selectedFee: FeeChoice | null;
  feeFactsForCategory: number;
  feeNotComparableReason: string | null;
  countryMatch: boolean | null;
  languageStatus: 'confirmed' | 'not-confirmed' | 'unavailable' | null;
  languagePrograms: number;
  recognitionCount: number;
  lastCheckedAt: string | null;
  hardFailures: string[];
  hardUnknowns: string[];
  rankable: boolean;
  missing: string[];
}

export interface DimensionResult {
  available: boolean;
  leaderIds: string[];
  detail: string;
}

export interface ComparisonResult {
  evaluations: Evaluation[];
  dimensions: {
    cost: DimensionResult;
    subject: DimensionResult;
    location: DimensionResult;
  };
  costBasis:
    | {
        currency: string;
        academicYear: string;
        coverage: string;
        degree: DegreeLevel;
        applicantCategory: ApplicantCategory;
      }
    | null;
  outcome: {
    kind: 'recommendation' | 'no-single' | 'insufficient';
    title: string;
    detail: string;
    recommendedIds: string[];
  };
  gaps: string[];
  tradeoffs: Array<{ institutionId: string; texts: string[] }>;
}

export function matchingPrograms(record: Institution, options: CompareOptions): Program[] {
  return record.programs.filter((program) => {
    if (options.subject && program.subjectArea !== options.subject) return false;
    if (options.degree && program.degreeLevel !== options.degree) return false;
    return true;
  });
}

function relevantFeeChoices(record: Institution, options: CompareOptions): FeeChoice[] {
  if (!options.degree) return [];
  const matching = matchingPrograms(record, options);
  const matchingIds = new Set(matching.map((program) => program.id));
  const programChoices: FeeChoice[] = matching.flatMap((program) =>
    program.tuition.map((fee) => ({ fee, program })),
  );
  const institutionChoices: FeeChoice[] = record.tuition.map((fee) => ({ fee, program: null }));

  let pool = [...programChoices, ...institutionChoices];
  pool = pool.filter(
    (choice) =>
      choice.fee.applicantCategory === options.applicantCategory &&
      choice.fee.degreeLevel === options.degree &&
      choice.fee.amount.min > 0,
  );
  // If a subject is selected, a programme-specific fact for that subject is the
  // most relevant. Otherwise an institution-wide fact is preferred, because the
  // cheapest single programme would not represent the institution.
  if (options.subject) {
    const programSpecific = pool.filter(
      (choice) => choice.program && matchingIds.has(choice.program.id),
    );
    if (programSpecific.length > 0) pool = programSpecific;
  } else {
    const institutionWide = pool.filter((choice) => !choice.program);
    if (institutionWide.length > 0) pool = institutionWide;
  }
  return pool;
}

export function bestFee(record: Institution, options: CompareOptions): {
  choice: FeeChoice | null;
  reason: string | null;
  totalForCategory: number;
} {
  const choices = relevantFeeChoices(record, options);
  const totalForCategory = choices.length;
  if (!options.degree) {
    return { choice: null, reason: 'Choose a degree level to compare fees like-for-like.', totalForCategory };
  }
  if (choices.length === 0) {
    return {
      choice: null,
      reason: `No source-checked fee fact is available for ${APPLICANT_LABELS[options.applicantCategory].toLowerCase()} at ${DEGREE_LABELS[options.degree]} level.`,
      totalForCategory,
    };
  }
  const annual = choices.filter((choice) => choice.fee.unit === 'per-year');
  if (annual.length === 0) {
    return {
      choice: null,
      reason: 'Only per-semester, per-credit or whole-programme fees are available. They cannot be compared without converting units, which this release does not do.',
      totalForCategory,
    };
  }
  annual.sort((a, b) => (feeAmountForSort(a.fee) ?? Number.POSITIVE_INFINITY) - (feeAmountForSort(b.fee) ?? Number.POSITIVE_INFINITY));
  const choice = annual[0] ?? null;
  if (!options.subject && choice?.program) {
    return {
      choice,
      reason:
        'Only programme-specific fees are available. Choose a subject so the same programme can be compared across institutions.',
      totalForCategory,
    };
  }
  return { choice, reason: null, totalForCategory };
}

function evaluate(record: Institution, options: CompareOptions): Evaluation {
  const matching = matchingPrograms(record, options);
  const programData: Evaluation['programData'] =
    record.programs.length === 0 ? 'unavailable' : matching.length === 0 ? 'none-listed' : 'available';
  const best = bestFee(record, options);
  const languagePrograms = options.languagePreference
    ? record.programs.filter((program) => program.language === options.languagePreference).length
    : 0;
  const languageStatus: Evaluation['languageStatus'] = !options.languagePreference
    ? null
    : record.programs.length === 0
      ? 'unavailable'
      : languagePrograms > 0
        ? 'confirmed'
        : 'not-confirmed';
  const countryMatch = options.countryPreference ? record.country.code === options.countryPreference : null;

  const hardFailures: string[] = [];
  const hardUnknowns: string[] = [];
  if (options.requireSourceChecked && record.verification.level !== 'source-checked') {
    hardFailures.push('Not a source-checked profile.');
  }
  if (options.requireFeeData && !record.programs.some((p) => p.tuition.length > 0) && record.tuition.length === 0) {
    hardFailures.push('No source-checked fee data.');
  }
  if (options.requireCountry && options.countryPreference && record.country.code !== options.countryPreference) {
    hardFailures.push('Not in the required country.');
  }
  if (options.requireProgram) {
    const hasFilter = Boolean(options.subject || options.degree);
    if (!hasFilter) {
      // No filter selected means the requirement is not meaningful yet.
    } else if (matching.length > 0) {
      // confirmed
    } else if (record.programs.length === 0) {
      hardUnknowns.push('Programme data is not available, so a matching programme cannot be confirmed.');
    } else {
      hardUnknowns.push('No matching programme is listed in the source-checked, selective programme list.');
    }
  }

  const missing: string[] = [];
  if (!best.choice) missing.push('comparable fee');
  if (programData !== 'available') missing.push('source-checked matching programme');
  if (languageStatus === 'unavailable' || languageStatus === 'not-confirmed') missing.push('confirmed teaching language');
  if (record.recognition.length === 0) missing.push('source-checked recognition');
  if (record.verification.level !== 'source-checked') missing.push('source-checked profile');

  return {
    id: record.id,
    name: record.names.primary,
    institution: record,
    matchingPrograms: matching.slice(0, 8),
    programData,
    selectedFee: best.choice,
    feeFactsForCategory: best.totalForCategory,
    feeNotComparableReason: best.reason,
    countryMatch,
    languageStatus,
    languagePrograms,
    recognitionCount: record.recognition.length,
    lastCheckedAt: record.verification.lastCheckedAt,
    hardFailures,
    hardUnknowns,
    rankable: hardFailures.length === 0 && hardUnknowns.length === 0,
    missing,
  };
}

function costDimension(evaluations: Evaluation[], options: CompareOptions): {
  dimension: DimensionResult;
  basis: ComparisonResult['costBasis'];
  gaps: string[];
} {
  const gaps: string[] = [];
  if (!options.degree) {
    return {
      dimension: {
        available: false,
        leaderIds: [],
        detail: 'Choose a degree level so fees refer to the same level of study.',
      },
      basis: null,
      gaps: ['Fee comparison needs a degree level. It is not inferred from other institutions.'],
    };
  }
  const eligible = evaluations.filter(
    (evaluation) => evaluation.rankable && evaluation.selectedFee && !evaluation.feeNotComparableReason,
  );
  if (eligible.length < 2) {
    return {
      dimension: {
        available: false,
        leaderIds: [],
        detail: `${eligible.length} institution${eligible.length === 1 ? '' : 's'} ${eligible.length === 1 ? 'has' : 'have'} a comparable fee. At least two are needed for a cost comparison.`,
      },
      basis: null,
      gaps: [
        'Missing fee data is not treated as expensive or cheap. Institutions without a comparable fee are left out of the cost ranking.',
      ],
    };
  }
  const currencies = new Set(eligible.map((evaluation) => evaluation.selectedFee!.fee.amount.currency));
  const years = new Set(eligible.map((evaluation) => evaluation.selectedFee!.fee.academicYear));
  const coverages = new Set(eligible.map((evaluation) => evaluation.selectedFee!.fee.coverage));
  if (currencies.size > 1) {
    gaps.push(
      `The selected fees use ${[...currencies].join(', ')}. No exchange rate source is included, so no cross-currency cost ranking is made.`,
    );
    return {
      dimension: {
        available: false,
        leaderIds: [],
        detail: 'Fees are in different currencies. No conversion is applied.',
      },
      basis: null,
      gaps,
    };
  }
  if (years.size > 1) {
    gaps.push(
      `The selected fees refer to different academic years (${[...years].join(', ')}). They are shown but not ranked.`,
    );
    return {
      dimension: { available: false, leaderIds: [], detail: 'Fees refer to different academic years.' },
      basis: null,
      gaps,
    };
  }
  if (coverages.size > 1) {
    gaps.push(
      `Some selected fees are tuition-only while others include mandatory fees. They are shown but not ranked as like-for-like.`,
    );
    return {
      dimension: {
        available: false,
        leaderIds: [],
        detail: 'Fee coverage differs (tuition only vs tuition and mandatory fees).',
      },
      basis: null,
      gaps,
    };
  }
  const sorted = [...eligible].sort((a, b) => {
    const left = feeAmountForSort(a.selectedFee!.fee) ?? Number.POSITIVE_INFINITY;
    const right = feeAmountForSort(b.selectedFee!.fee) ?? Number.POSITIVE_INFINITY;
    return left - right;
  });
  const lowest = feeAmountForSort(sorted[0]!.selectedFee!.fee)!;
  const leaderIds = sorted
    .filter((evaluation) => feeAmountForSort(evaluation.selectedFee!.fee) === lowest)
    .map((evaluation) => evaluation.id);
  gaps.push(
    'Cost comparison uses the lowest published annual figure for the selected category and degree. Ranges are compared by their lower bound; check the full range on the profile.',
  );
  const first = sorted[0]!.selectedFee!.fee;
  return {
    dimension: {
      available: true,
      leaderIds,
      detail: leaderIds.length === 1
        ? `Lowest comparable annual figure: ${formatFeeAmount(first.amount)} (${first.academicYear}).`
        : `Two or more institutions share the lowest listed annual figure.`,
    },
    basis: {
      currency: first.amount.currency!,
      academicYear: first.academicYear,
      coverage: first.coverage,
      degree: options.degree,
      applicantCategory: options.applicantCategory,
    },
    gaps,
  };
}

function subjectDimension(evaluations: Evaluation[], options: CompareOptions): DimensionResult {
  if (!options.subject && !options.degree) {
    return {
      available: false,
      leaderIds: [],
      detail: 'Choose a subject or degree to compare programme fit.',
    };
  }
  const eligible = evaluations.filter((evaluation) => evaluation.rankable && evaluation.matchingPrograms.length > 0);
  if (eligible.length < 2) {
    return {
      available: false,
      leaderIds: [],
      detail: 'Fewer than two institutions have a source-checked programme matching these filters.',
    };
  }
  const max = Math.max(...eligible.map((evaluation) => evaluation.matchingPrograms.length));
  const leaderIds = eligible
    .filter((evaluation) => evaluation.matchingPrograms.length === max)
    .map((evaluation) => evaluation.id);
  return {
    available: true,
    leaderIds,
    detail: `Most listed matching programmes: ${max}. The programme list is selective; this is not a quality measure.`,
  };
}

function locationDimension(evaluations: Evaluation[], options: CompareOptions): DimensionResult {
  if (!options.countryPreference && !options.languagePreference) {
    return {
      available: false,
      leaderIds: [],
      detail: 'Set a country or teaching-language preference to compare location and language.',
    };
  }
  const score = (evaluation: Evaluation): { score: number; known: boolean } => {
    let value = 0;
    let known = true;
    if (options.countryPreference) {
      if (evaluation.countryMatch) value += 2;
    }
    if (options.languagePreference) {
      if (evaluation.languageStatus === 'confirmed') value += 1;
      else if (evaluation.languageStatus === 'unavailable') known = false;
    }
    return { score: value, known };
  };
  const eligible = evaluations.filter(
    (evaluation) => evaluation.rankable && evaluation.hardFailures.length === 0,
  );
  const known = eligible.filter((evaluation) => score(evaluation).known);
  if (known.length < 2) {
    return {
      available: false,
      leaderIds: [],
      detail: 'Fewer than two institutions have confirmed data for this location/language preference.',
    };
  }
  const max = Math.max(...known.map((evaluation) => score(evaluation).score));
  if (max === 0) {
    return {
      available: false,
      leaderIds: [],
      detail: 'No selected institution confirms a match for this preference.',
    };
  }
  return {
    available: true,
    leaderIds: known.filter((evaluation) => score(evaluation).score === max).map((evaluation) => evaluation.id),
    detail: 'Based only on the country recorded in the directory and teaching languages confirmed by source-checked programmes.',
  };
}

function buildTradeoffs(evaluations: Evaluation[], options: CompareOptions): ComparisonResult['tradeoffs'] {
  return evaluations.map((evaluation) => {
    const texts: string[] = [];
    if (evaluation.selectedFee) {
      const { fee, program } = evaluation.selectedFee;
      texts.push(
        `A listed annual figure for ${APPLICANT_LABELS[options.applicantCategory].toLowerCase()}: ${formatFeeAmount(fee.amount)} for ${fee.academicYear}${program ? ` (${program.name})` : ' (institution-wide listing)'}. ${FEE_COVERAGE_LABELS[fee.coverage].toLowerCase()}.`, 
      );
    } else {
      texts.push(evaluation.feeNotComparableReason ?? 'No comparable annual fee is available.');
    }
    if (options.subject || options.degree) {
      if (evaluation.programData === 'available') {
        texts.push(
          `${evaluation.matchingPrograms.length} matching source-checked programme${evaluation.matchingPrograms.length === 1 ? '' : 's'}${options.subject ? ` in ${subjectLabel(options.subject)}` : ''}.`,
        );
      } else if (evaluation.programData === 'unavailable') {
        texts.push('Programme data is not available in this release. That is a gap, not a finding.');
      } else {
        texts.push('No matching programme is listed in the selective, source-checked programme list.');
      }
    }
    if (options.countryPreference) {
      texts.push(
        evaluation.countryMatch
          ? `Country matches your preference (${evaluation.institution.country.name}).`
          : `Country does not match your preference (${evaluation.institution.country.name}).`,
      );
    }
    if (options.languagePreference) {
      texts.push(
        evaluation.languageStatus === 'confirmed'
          ? `Teaching language confirmed by ${evaluation.languagePrograms} source-checked programme${evaluation.languagePrograms === 1 ? '' : 's'}.`
          : 'Teaching language is not confirmed by the source-checked programme data.',
      );
    }
    texts.push(
      evaluation.recognitionCount > 0
        ? `${evaluation.recognitionCount} source-checked recognition entr${evaluation.recognitionCount === 1 ? 'y' : 'ies'}.`
        : 'Recognition/accreditation is not source-checked in this release. Absence is not evidence of non-accreditation.',
    );
    if (evaluation.lastCheckedAt) {
      texts.push(`Official pages last read on ${formatDate(evaluation.lastCheckedAt)}.`);
    }
    if (evaluation.hardFailures.length > 0) texts.push(`Hard requirement not met: ${evaluation.hardFailures.join(' ')}`);
    if (evaluation.hardUnknowns.length > 0) texts.push(`Hard requirement unconfirmed: ${evaluation.hardUnknowns.join(' ')}`);
    return { institutionId: evaluation.id, texts };
  });
}

export function compareInstitutions(records: Institution[], rawOptions: Partial<CompareOptions>): ComparisonResult {
  const options: CompareOptions = { ...DEFAULT_COMPARE_OPTIONS, ...rawOptions };
  const evaluations = records.map((record) => evaluate(record, options));
  const cost = costDimension(evaluations, options);
  const subject = subjectDimension(evaluations, options);
  const location = locationDimension(evaluations, options);
  const dimensions = { cost: cost.dimension, subject, location };
  const gaps = [...cost.gaps];

  if (subject.available) {
    gaps.push(
      'Programme fit counts only source-checked, selective programme listings. Missing programmes are not treated as absent.',
    );
  }
  if (location.available) {
    gaps.push('Location/language comparison uses only confirmed directory and programme data.');
  }
  if (evaluations.some((evaluation) => evaluation.institution.verification.level !== 'source-checked')) {
    gaps.push('Some selected institutions are directory records; their missing facts stay missing rather than becoming zero or false.');
  }
  if (evaluations.some((evaluation) => evaluation.hardUnknowns.length > 0)) {
    gaps.push('Institutions with unconfirmed hard requirements are shown but excluded from recommendations.');
  }

  const tradeoffs = buildTradeoffs(evaluations, options);
  const rankable = evaluations.filter((evaluation) => evaluation.rankable);
  const availableDimensions = [dimensions.cost, dimensions.subject, dimensions.location].filter(
    (dimension) => dimension.available,
  );

  let outcome: ComparisonResult['outcome'];
  if (availableDimensions.length === 0) {
    outcome = {
      kind: 'insufficient',
      title: 'No reliable overall recommendation can be made',
      detail:
        'There is not enough comparable, source-checked evidence for the selected priorities. The trade-offs below show what is missing; missing data is not treated as poor performance.',
      recommendedIds: [],
    };
  } else {
    const leaderCounts = new Map<string, number>();
    for (const dimension of availableDimensions) {
      for (const id of dimension.leaderIds) {
        leaderCounts.set(id, (leaderCounts.get(id) ?? 0) + 1);
      }
    }
    const viable = rankable.filter((evaluation) => leaderCounts.has(evaluation.id));
    const maxCount = Math.max(0, ...[...leaderCounts.values()]);
    const leaders = viable.filter((evaluation) => leaderCounts.get(evaluation.id) === maxCount);
    const chosen = [...leaders].sort((a, b) => leaderCounts.get(b.id)! - leaderCounts.get(a.id)!);

    if (options.priority === 'balanced') {
      if (maxCount < 2 || chosen.length === 0) {
        outcome = {
          kind: 'no-single',
          title: 'No single best-supported option',
          detail:
            'No institution leads on at least two dimensions with comparable evidence. That is not a verdict on quality; it means your priorities do not separate these options with the data available.',
          recommendedIds: [],
        };
      } else if (chosen.length > 1) {
        outcome = {
          kind: 'no-single',
          title: 'Two or more options are equally supported',
          detail:
            'The available evidence does not separate these options on your priorities. Compare the trade-offs rather than relying on a made-up score.',
          recommendedIds: chosen.map((evaluation) => evaluation.id),
        };
      } else {
        outcome = {
          kind: 'recommendation',
          title: `Best supported by your priorities: ${chosen[0]!.name}`,
          detail:
            'This is not a quality ranking or an admission prediction. It reflects only the dimensions with comparable, source-checked data; the gaps list shows what was not compared.',
          recommendedIds: [chosen[0]!.id],
        };
      }
    } else {
      const priorityDimension =
        options.priority === 'cost' ? dimensions.cost : options.priority === 'subject' ? dimensions.subject : dimensions.location;
      if (!priorityDimension.available) {
        outcome = {
          kind: 'insufficient',
          title: 'No reliable recommendation for this priority',
          detail: priorityDimension.detail,
          recommendedIds: [],
        };
      } else if (priorityDimension.leaderIds.length === 0) {
        outcome = {
          kind: 'no-single',
          title: 'No single best-supported option',
          detail: priorityDimension.detail,
          recommendedIds: [],
        };
      } else {
        const recommended = priorityDimension.leaderIds;
        const names = recommended
          .map((id) => evaluations.find((evaluation) => evaluation.id === id)?.name)
          .filter(Boolean)
          .join(' and ');
        outcome = {
          kind: recommended.length === 1 ? 'recommendation' : 'no-single',
          title:
            recommended.length === 1
              ? `Best supported on ${options.priority === 'cost' ? 'lower cost' : options.priority === 'subject' ? 'subject fit' : 'location & language'}: ${names}`
              : `Equally supported: ${names}`,
          detail:
            'This is not a quality ranking. It uses only the dimension you chose and the comparable, source-checked data shown below.',
          recommendedIds: recommended,
        };
      }
    }
  }

  return {
    evaluations,
    dimensions,
    costBasis: cost.basis,
    outcome,
    gaps: [...new Set(gaps)],
    tradeoffs,
  };
}

export function feeContextLine(evaluation: Evaluation, options: CompareOptions): string {
  if (!evaluation.selectedFee) return 'No comparable annual fee';
  const { fee } = evaluation.selectedFee;
  return `${formatFeeAmount(fee.amount)} · ${FEE_UNIT_LABELS[fee.unit]} · ${FEE_COVERAGE_LABELS[fee.coverage]}`;
}
