import type { InstitutionKind, ListingScope, VerificationStatus } from '../../shared/types';

export interface BadgeInfo {
  label: string;
  tone: 'positive' | 'neutral' | 'caution' | 'muted';
  description: string;
}

export function verificationInfo(status: VerificationStatus): BadgeInfo {
  switch (status) {
    case 'official-source-checked':
      return {
        label: 'Source-checked',
        tone: 'positive',
        description:
          'A person read the linked official page on the date shown. This is not a live feed, and pages can change.',
      };
    case 'directory-only':
      return {
        label: 'Directory record',
        tone: 'neutral',
        description:
          'Discovery listing only. We have not read the institution’s official pages for this release, so programmes, fees, deadlines and recognition are not shown.',
      };
    case 'needs-verification':
      return {
        label: 'Needs verification',
        tone: 'caution',
        description: 'This value has not been confirmed on an official page.',
      };
    case 'not-available':
      return {
        label: 'Not available',
        tone: 'muted',
        description: 'The information is not available in this release. Nothing has been inferred.',
      };
  }
}

export function scopeBasisInfo(code: string): { label: string; description: string } {
  switch (code) {
    case 'source-checked':
      return {
        label: 'Source-checked profile',
        description:
          'Facts on this profile link to official university or authority pages that we read on the dates shown.',
      };
    case 'hipo-directory':
      return {
        label: 'Community university directory',
        description:
          'Listed in the Hipo university/college directory, a community-maintained list. It is not an official register and does not prove accreditation or current offerings.',
      };
    case 'university-name-heuristic':
      return {
        label: 'University-name heuristic',
        description:
          'The organisation’s recorded name looked like a university name in our multilingual heuristic. This is a discovery aid, not an official classification.',
      };
    case 'ror-education':
      return {
        label: 'Broader ROR education record',
        description:
          'ROR records this organisation as “education”, but it was not classified as a university. It is only shown when broader education records are enabled.',
      };
    default:
      return {
        label: code || 'Directory record',
        description: 'Directory listing only; no official page was checked for this record.',
      };
  }
}

export function scopeInfo(scope: ListingScope): BadgeInfo {
  if (scope === 'education') {
    return {
      label: 'Broader education record',
      tone: 'caution',
      description:
        'Not classified as a university. Shown only in the broader education scope, which includes research institutes and other education organisations.',
    };
  }
  return {
    label: 'University scope',
    tone: 'neutral',
    description:
      'In the university scope because of a community university listing, a source-checked profile, or a transparent name heuristic. None of these is an accreditation authority.',
  };
}

export function kindLabel(kind: InstitutionKind): string {
  switch (kind) {
    case 'university':
      return 'University';
    case 'technical-university':
      return 'Technical university';
    case 'college':
      return 'College';
    case 'institute':
      return 'Institute';
    case 'academy':
      return 'Academy';
    default:
      return 'Not classified in this release';
  }
}

export function recognitionStatusLabel(status: string): string {
  switch (status) {
    case 'accredited':
      return 'Accredited';
    case 'recognized':
      return 'Recognised';
    case 'approved':
      return 'Approved';
    case 'listed':
      return 'Listed';
    default:
      return status;
  }
}

export const REPORT_FIELDS: Array<{ id: string; label: string }> = [
  { id: 'name', label: 'Name or alternate name' },
  { id: 'city', label: 'City or location' },
  { id: 'website', label: 'Official website' },
  { id: 'programs', label: 'Programmes or degree levels' },
  { id: 'tuition', label: 'Tuition or fees' },
  { id: 'deadlines', label: 'Deadlines or intake' },
  { id: 'admissions', label: 'Admission requirements' },
  { id: 'recognition', label: 'Recognition or accreditation' },
  { id: 'scholarships', label: 'Scholarships' },
  { id: 'coverage', label: 'Coverage or missing record' },
  { id: 'other', label: 'Something else' },
];

export const REPORT_ISSUE_TYPES: Array<{ id: string; label: string }> = [
  { id: 'incorrect', label: 'Incorrect information' },
  { id: 'outdated', label: 'Out of date' },
  { id: 'missing', label: 'Missing information' },
  { id: 'source-problem', label: 'Broken or wrong source link' },
  { id: 'other', label: 'Other' },
];

export const COMPARE_PRIORITIES = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Weigh cost, programme fit and location together — without inventing a quality score.',
  },
  {
    id: 'cost',
    label: 'Lower cost',
    description: 'Compare only same-unit, same-currency, same-applicant, same-year fee facts.',
  },
  {
    id: 'subject',
    label: 'Subject fit',
    description: 'Count source-checked programmes matching your subject and degree.',
  },
  {
    id: 'location',
    label: 'Location & language',
    description: 'Use country and verified teaching-language data; missing language stays unconfirmed.',
  },
] as const;
