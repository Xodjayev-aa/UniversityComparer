import type {
  ApplicantCategory,
  DegreeLevel,
  FeeCoverage,
  FeeUnit,
  ListingScope,
  StudyMode,
  VerificationStatus,
} from './types.js';

export const DEGREE_LEVELS: Array<{ id: DegreeLevel; label: string; short: string }> = [
  { id: 'bachelor', label: "Bachelor's", short: 'Bachelor' },
  { id: 'master', label: "Master's", short: 'Master' },
  { id: 'doctorate', label: 'Doctorate', short: 'Doctorate' },
  { id: 'non-degree', label: 'Non-degree / short course', short: 'Non-degree' },
];

export const SUBJECTS: Array<{ id: string; label: string; blurb: string }> = [
  { id: 'computer-science', label: 'Computer science', blurb: 'Computing, software, data and AI' },
  { id: 'engineering', label: 'Engineering', blurb: 'Civil, mechanical, electrical, chemical' },
  { id: 'business-management', label: 'Business & management', blurb: 'Business, finance, accounting' },
  { id: 'economics', label: 'Economics', blurb: 'Economics and economic policy' },
  { id: 'law', label: 'Law', blurb: 'Law and legal studies' },
  { id: 'medicine-health', label: 'Medicine & health', blurb: 'Medicine, nursing, public health' },
  { id: 'natural-sciences', label: 'Natural sciences', blurb: 'Physics, chemistry, biology, geoscience' },
  { id: 'mathematics', label: 'Mathematics', blurb: 'Mathematics and statistics' },
  { id: 'social-sciences', label: 'Social sciences', blurb: 'Politics, sociology, psychology, anthropology' },
  { id: 'humanities', label: 'Humanities', blurb: 'History, philosophy, languages, religion' },
  { id: 'arts-design', label: 'Arts & design', blurb: 'Visual arts, design, music, performing arts' },
  { id: 'education', label: 'Education', blurb: 'Teacher education and pedagogy' },
  { id: 'agriculture-environment', label: 'Agriculture & environment', blurb: 'Agriculture, forestry, sustainability' },
  { id: 'architecture-built-environment', label: 'Architecture & built environment', blurb: 'Architecture, planning, construction' },
  { id: 'media-communication', label: 'Media & communication', blurb: 'Journalism, media, communication' },
  { id: 'other', label: 'Other subject', blurb: 'Fields outside the current taxonomy' },
];

export const SUBJECT_IDS = SUBJECTS.map((s) => s.id);

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  is: 'Icelandic',
  pl: 'Polish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  el: 'Greek',
  tr: 'Turkish',
  ru: 'Russian',
  uk: 'Ukrainian',
  ar: 'Arabic',
  he: 'Hebrew',
  fa: 'Persian',
  ur: 'Urdu',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  sw: 'Swahili',
  am: 'Amharic',
  yo: 'Yoruba',
  zu: 'Zulu',
  af: 'Afrikaans',
  kk: 'Kazakh',
  uz: 'Uzbek',
  ky: 'Kyrgyz',
  az: 'Azerbaijani',
  hy: 'Armenian',
  ka: 'Georgian',
  sr: 'Serbian',
  hr: 'Croatian',
  sl: 'Slovenian',
  lt: 'Lithuanian',
  lv: 'Latvian',
  et: 'Estonian',
  ca: 'Catalan',
  eu: 'Basque',
  gl: 'Galician',
  cy: 'Welsh',
  ga: 'Irish',
  mt: 'Maltese',
  sq: 'Albanian',
  mk: 'Macedonian',
  bs: 'Bosnian',
  mn: 'Mongolian',
  ne: 'Nepali',
  si: 'Sinhala',
  km: 'Khmer',
  lo: 'Lao',
  my: 'Burmese',
};

export function languageLabel(code: string): string {
  if (!code) return 'Not available';
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

export const REGION_LABELS = {
  Africa: 'Africa',
  Americas: 'Americas',
  Asia: 'Asia',
  Europe: 'Europe',
  Oceania: 'Oceania',
  Other: 'Other / not classified',
} as const;

export const APPLICANT_LABELS: Record<ApplicantCategory, string> = {
  all: 'All applicants',
  international: 'International applicants',
  domestic: 'Domestic applicants',
  home: 'Home-fee-status applicants',
  'eu-eea': 'EU/EEA applicants',
  'in-state': 'In-state applicants',
  'out-of-state': 'Out-of-state applicants',
  other: 'Other / see note',
};

export const DEGREE_LABELS: Record<DegreeLevel, string> = Object.fromEntries(
  DEGREE_LEVELS.map((d) => [d.id, d.label]),
) as Record<DegreeLevel, string>;

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
};

export const FEE_UNIT_LABELS: Record<FeeUnit, string> = {
  'per-year': 'per year',
  'per-semester': 'per semester',
  'per-term': 'per term',
  'per-credit': 'per credit',
  'total-program': 'for the whole programme',
  'per-month': 'per month',
};

export const FEE_COVERAGE_LABELS: Record<FeeCoverage, string> = {
  'tuition-only': 'Tuition only (mandatory fees may be extra)',
  'including-mandatory-fees': 'Includes mandatory fees',
  'mandatory-fees-separate': 'Mandatory fees listed separately',
  unclear: 'Coverage not clearly stated',
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  'official-source-checked': 'Source-checked',
  'needs-verification': 'Needs verification',
  'directory-only': 'Directory record only',
  'not-available': 'Not available',
};

export const SCOPE_LABELS: Record<ListingScope, string> = {
  university: 'University directory',
  education: 'Broader education record',
};

export const VERIFICATION_LEVEL_LABELS: Record<'source-checked' | 'directory-only', string> = {
  'source-checked': 'Source-checked profile',
  'directory-only': 'Directory record',
};

export const APPLICANT_SHORT_LABELS: Record<ApplicantCategory, string> = {
  all: 'All',
  international: 'International',
  domestic: 'Domestic',
  home: 'Home fee status',
  'eu-eea': 'EU/EEA',
  'in-state': 'In-state',
  'out-of-state': 'Out-of-state',
  other: 'Other category',
};

export function subjectLabel(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.label ?? 'Other subject';
}

export const EDUCATION_ORG_NOTE =
  'ROR type “education” is broad and includes research institutes and other education organisations. This record has not been classified as a university.';
