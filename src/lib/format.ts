import type {
  ApplicantCategory,
  DeadlineFact,
  FeeAmount,
  FeeFact,
  Institution,
  Program,
  SourceRef,
} from '../../shared/types';
import {
  APPLICANT_LABELS,
  DEGREE_LABELS,
  FEE_COVERAGE_LABELS,
  FEE_UNIT_LABELS,
  STUDY_MODE_LABELS,
  languageLabel,
} from '../../shared/taxonomy';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = parseIsoDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

export function daysBetween(fromIso: string, to: Date = new Date()): number | null {
  const from = parseIsoDate(fromIso);
  if (!from) return null;
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toUtc - from.getTime()) / 86_400_000);
}

export function sourceAge(retrievedAt: string, now: Date = new Date()): string {
  const days = daysBetween(retrievedAt, now);
  if (days === null) return 'Read date not available';
  if (days <= 0) return 'Read today';
  if (days === 1) return 'Read yesterday';
  if (days < 7) return `Read ${days} days ago`;
  if (days < 45) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? 'Read 1 week ago' : `Read ${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? 'Read 1 month ago' : `Read ${months} months ago`;
  }
  return `Read over a year ago`;
}

export function sourceAgeWarning(retrievedAt: string, now: Date = new Date()): string | null {
  const days = daysBetween(retrievedAt, now);
  if (days === null) return 'The source read date is not recorded.';
  if (days > 365) return 'This source was read more than a year ago and may be out of date.';
  if (days > 180) return 'This source was read more than six months ago. Check the official page before relying on it.';
  return null;
}

export function deadlineTiming(deadline: DeadlineFact, now: Date = new Date()): {
  label: string;
  tone: 'neutral' | 'soon' | 'passed' | 'unknown';
} {
  if (!deadline.date) {
    return { label: 'No single calendar date stated', tone: 'unknown' };
  }
  const date = parseIsoDate(deadline.date);
  if (!date) return { label: 'Date could not be read', tone: 'unknown' };
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.ceil((date.getTime() - nowUtc) / 86_400_000);
  if (diff < 0) return { label: 'Listed date has passed', tone: 'passed' };
  if (diff === 0) return { label: 'Listed for today', tone: 'soon' };
  if (diff <= 30) return { label: `Listed ${diff} days from now`, tone: 'soon' };
  return { label: 'Future date listed', tone: 'neutral' };
}

export function formatMoney(amount: number, currency: string | null): string {
  if (!currency) return 'Not available';
  const formatted = new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return `${currency} ${formatted}`;
}

export function formatFeeAmount(amount: FeeAmount): string {
  if (amount.kind === 'range' && amount.max !== null) {
    return `${formatMoney(amount.min, amount.currency)}–${formatMoney(amount.max, amount.currency).replace(`${amount.currency} `, '')}`;
  }
  return formatMoney(amount.min, amount.currency);
}

export function feeAmountForSort(fee: FeeFact): number | null {
  return fee.amount.min;
}

export function feeContext(fee: FeeFact): string {
  return [
    fee.academicYear,
    APPLICANT_LABELS[fee.applicantCategory],
    DEGREE_LABELS[fee.degreeLevel],
    FEE_UNIT_LABELS[fee.unit],
    FEE_COVERAGE_LABELS[fee.coverage],
    fee.studyMode ? STUDY_MODE_LABELS[fee.studyMode] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function feeApplicant(fee: FeeFact): string {
  return APPLICANT_LABELS[fee.applicantCategory];
}

export function deadlineContext(deadline: DeadlineFact): string {
  return [
    deadline.intake,
    deadline.academicYear,
    APPLICANT_LABELS[deadline.applicantCategory],
    DEGREE_LABELS[deadline.degreeLevel],
    deadline.programId ? 'Programme-specific' : 'University-wide',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function programContext(program: Program): string {
  return [
    DEGREE_LABELS[program.degreeLevel],
    program.faculty,
    program.language ? languageLabel(program.language) : 'Teaching language not source-checked',
    program.duration,
    program.studyModes.length
      ? program.studyModes.map((mode) => STUDY_MODE_LABELS[mode]).join(', ')
      : 'Study mode not source-checked',
    program.campus,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function intakeLabel(value: string | null | undefined): string {
  return value?.trim() || 'Intake not specified';
}

export function applicantLabel(category: ApplicantCategory): string {
  return APPLICANT_LABELS[category];
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

export function countryAndCity(institution: Pick<Institution, 'country' | 'locations'>): string {
  const city = institution.locations.find((location) => location.city)?.city;
  return city ? `${city}, ${institution.country.name}` : institution.country.name;
}

export function sourceLabel(source: SourceRef): string {
  return source.publisher ? `${source.title} · ${source.publisher}` : source.title;
}

export function truncate(value: string, max = 180): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function relativeSaved(savedAt: string, now: Date = new Date()): string {
  const saved = new Date(savedAt);
  if (Number.isNaN(saved.getTime())) return 'Saved date unknown';
  const days = Math.floor((now.getTime() - saved.getTime()) / 86_400_000);
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Saved yesterday';
  if (days < 30) return `Saved ${days} days ago`;
  if (days < 365) return `Saved ${Math.round(days / 30)} months ago`;
  return 'Saved over a year ago';
}
