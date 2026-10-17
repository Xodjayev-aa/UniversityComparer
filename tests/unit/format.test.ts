import { describe, expect, it } from 'vitest';
import {
  deadlineContext,
  deadlineTiming,
  feeAmountForSort,
  feeContext,
  formatFeeAmount,
  formatMoney,
  sourceAge,
  sourceAgeWarning,
} from '../../src/lib/format';
import { deadline, fee } from '../helpers/fixtures';

const NOW = new Date('2026-10-17T12:00:00Z');

describe('money and fee context', () => {
  it('shows the original currency, never a converted amount', () => {
    expect(formatMoney(39_620, 'GBP')).toBe('GBP 39,620');
    expect(formatMoney(1_234.5, 'CAD')).toBe('CAD 1,234.5');
    expect(formatMoney(10, null)).toBe('Not available');
    expect(formatFeeAmount({ kind: 'range', min: 39_620, max: 66_580, currency: 'GBP' })).toBe(
      'GBP 39,620–66,580',
    );
    expect(formatFeeAmount({ kind: 'exact', min: 10_050, max: 10_050, currency: 'GBP' })).toBe(
      'GBP 10,050',
    );
  });

  it('keeps unit, coverage, year, applicant category and study mode visible', () => {
    const context = feeContext(fee());
    expect(context).toContain('2026/27');
    expect(context).toContain('International applicants');
    expect(context).toContain("Bachelor's");
    expect(context).toContain('per year');
    expect(context).toContain('Tuition only');
    expect(context).toContain('Full-time');
  });

  it('sorts by the lower bound of a published range', () => {
    expect(feeAmountForSort(fee({ amount: { kind: 'range', min: 5, max: 9, currency: 'EUR' } }))).toBe(5);
  });

  it('labels an institution-wide deadline separately from a programme deadline', () => {
    expect(deadlineContext(deadline({ programId: null }))).toContain('University-wide');
    expect(deadlineContext(deadline({ programId: 'prog-cs' }))).toContain('Programme-specific');
    expect(deadlineContext(deadline({ applicantCategory: 'all' }))).toContain('All applicants');
  });
});

describe('dates and staleness', () => {
  it('marks passed, upcoming and distant deadlines without pretending they are current', () => {
    expect(deadlineTiming(deadline({ date: '2026-10-15' }), NOW)).toEqual({
      label: 'Listed date has passed',
      tone: 'passed',
    });
    expect(deadlineTiming(deadline({ date: '2026-10-17' }), NOW).tone).toBe('soon');
    expect(deadlineTiming(deadline({ date: '2026-10-27' }), NOW).label).toBe('Listed 10 days from now');
    expect(deadlineTiming(deadline({ date: '2027-03-01' }), NOW).tone).toBe('neutral');
    expect(deadlineTiming(deadline({ date: null }), NOW).tone).toBe('unknown');
  });

  it('describes when a page was read, not when it was updated', () => {
    expect(sourceAge('2026-10-17', NOW)).toBe('Read today');
    expect(sourceAge('2026-10-10', NOW)).toBe('Read 1 week ago');
    expect(sourceAge('2026-09-01', NOW)).toBe('Read 2 months ago');
    expect(sourceAge('2025-01-01', NOW)).toBe('Read over a year ago');
    expect(sourceAgeWarning('2025-01-01', NOW)).toContain('more than a year');
    expect(sourceAgeWarning('2026-10-17', NOW)).toBeNull();
  });
});
