/**
 * UniScope domain types.
 *
 * Two evidence levels exist and must never be blended:
 *  - directory-only: identity/geography from an open directory; no programme,
 *    fee, deadline, scholarship or recognition claims.
 *  - source-checked: a fact read on an official page, with the page URL, the
 *    date it was read and, where stated, the year/intake/applicant context.
 *
 * Missing data is represented by absence of a fact (or null for scalar
 * fields) — never by a zero, a guess or an inferred value.
 */

export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania' | 'Other';

export type ListingScope = 'university' | 'education';

export type InstitutionKind =
  | 'university'
  | 'technical-university'
  | 'college'
  | 'institute'
  | 'academy'
  | 'not-classified';

export type VerificationStatus =
  | 'official-source-checked'
  | 'directory-only'
  | 'needs-verification'
  | 'not-available';

export type FactVerification = 'official-source-checked' | 'needs-verification';

export type ApplicantCategory =
  | 'all'
  | 'international'
  | 'domestic'
  | 'home'
  | 'eu-eea'
  | 'in-state'
  | 'out-of-state'
  | 'other';

export type DegreeLevel = 'bachelor' | 'master' | 'doctorate' | 'non-degree';

export type StudyMode = 'full-time' | 'part-time';

export type FeeUnit =
  | 'per-year'
  | 'per-semester'
  | 'per-term'
  | 'per-credit'
  | 'total-program'
  | 'per-month';

export type FeeCoverage =
  | 'tuition-only'
  | 'including-mandatory-fees'
  | 'mandatory-fees-separate'
  | 'unclear';

export type ScopeBasis =
  | 'university-name-heuristic'
  | 'ror-education'
  | 'hipo-directory'
  | 'hipo-ror'
  | 'source-checked';

export interface CountryRef {
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string;
  name: string;
}

/**
 * A link to the page a fact came from. `retrievedAt` is when a person opened
 * the page; it is not an "updated" date. `publishedAt`/`effectiveAt` are only
 * present when the page itself states them.
 */
export interface SourceRef {
  url: string;
  title: string;
  publisher: string;
  /** ISO date (YYYY-MM-DD). */
  retrievedAt: string;
  /** ISO date (YYYY-MM-DD) or null when the page states none. */
  publishedAt: string | null;
  /** Free text, e.g. "2026/27 academic year" or an ISO date. Null when unstated. */
  effectiveAt: string | null;
  license: string | null;
}

export interface LocalName {
  lang: string;
  value: string;
  source: 'ror' | 'hipo' | 'official';
  /** e.g. "label", "alias", "acronym". */
  type: string;
}

export interface InstitutionNames {
  primary: string;
  official: string | null;
  aliases: string[];
  localNames: LocalName[];
  formerNames: string[];
}

export interface Location {
  city: string | null;
  region: string | null;
  countryCode: string;
  countryName: string;
  latitude: number | null;
  longitude: number | null;
  role: 'primary' | 'additional';
  source: 'ror' | 'hipo' | 'official';
}

export interface Campus {
  id: string;
  name: string;
  city: string | null;
  countryCode: string;
  source: SourceRef;
  verification: FactVerification;
}

export interface FeeAmount {
  kind: 'exact' | 'range';
  min: number;
  max: number | null;
  /** ISO 4217 code, uppercase. Original currency — no conversion is applied. */
  currency: string;
}

export interface FeeFact {
  id: string;
  /** Short human label, e.g. "International undergraduate tuition". */
  label: string;
  amount: FeeAmount;
  unit: FeeUnit;
  coverage: FeeCoverage;
  /** e.g. "2026/27". Required: a fee without a year is not comparable. */
  academicYear: string;
  /** e.g. "Autumn 2027". Null when the page does not tie the fee to an intake. */
  intake: string | null;
  applicantCategory: ApplicantCategory;
  degreeLevel: DegreeLevel;
  studyMode: StudyMode | null;
  campus: string | null;
  programId: string | null;
  /** Original wording or important caveats, never an inferred explanation. */
  notes: string | null;
  source: SourceRef;
  verification: FactVerification;
}

export interface DeadlineFact {
  id: string;
  /** ISO date, only when the source states an unambiguous calendar date. */
  date: string | null;
  /** The source's own wording, e.g. "15 January 2027, 23:59 CET". */
  dateText: string;
  /** e.g. "Autumn 2027". Required. */
  intake: string;
  academicYear: string;
  applicantCategory: ApplicantCategory;
  degreeLevel: DegreeLevel;
  programId: string | null;
  notes: string | null;
  source: SourceRef;
  verification: FactVerification;
}

export interface Program {
  id: string;
  name: string;
  degreeLevel: DegreeLevel;
  subjectArea: string;
  language: string | null;
  studyModes: StudyMode[];
  duration: string | null;
  campus: string | null;
  faculty: string | null;
  admissionsUrl: string | null;
  source: SourceRef;
  verification: FactVerification;
  tuition: FeeFact[];
  deadlines: DeadlineFact[];
  notes: string | null;
}

export type RecognitionStatus =
  | 'accredited'
  | 'recognised'
  | 'approved'
  | 'listed'
  | 'not-stated';

export interface Recognition {
  id: string;
  /** Accreditation / recognition body, as named by the source. */
  body: string;
  bodyUrl: string | null;
  /** What the source says the recognition covers (institution, programme, campus). */
  scope: string;
  status: RecognitionStatus;
  notes: string | null;
  source: SourceRef;
  verification: FactVerification;
}

export interface Scholarship {
  id: string;
  name: string;
  description: string;
  /** As stated, e.g. "Up to €5,000 per year"; null when the page states no amount. */
  amountText: string | null;
  audience: string | null;
  url: string;
  source: SourceRef;
  verification: FactVerification;
}

export interface AdmissionRequirement {
  id: string;
  text: string;
  degreeLevel: DegreeLevel;
  applicantCategory: ApplicantCategory;
  academicYear: string;
  intake: string | null;
  source: SourceRef;
  verification: FactVerification;
}

export type OfficialLinkKind =
  | 'admissions'
  | 'programs'
  | 'fees'
  | 'scholarships'
  | 'international'
  | 'application'
  | 'recognition'
  | 'other';

export interface OfficialLink {
  id: string;
  label: string;
  kind: OfficialLinkKind;
  url: string;
  source: SourceRef;
}

export interface InstitutionVerification {
  level: 'source-checked' | 'directory-only';
  /** Latest retrievedAt among the facts shown; null for directory-only records. */
  lastCheckedAt: string | null;
  /** Count of individual sourced facts (not "sources"). */
  checkedFacts: number;
  note: string;
}

export interface ListingInfo {
  hipo: boolean;
  ror: boolean;
  curated: boolean;
  scopeBasis: ScopeBasis;
  /** Plain-language explanation of how the record entered the dataset. */
  basisNote: string;
}

export interface Institution {
  id: string;
  rorId: string | null;
  domains: string[];
  names: InstitutionNames;
  country: CountryRef;
  region: Region;
  locations: Location[];
  website: string | null;
  kind: InstitutionKind;
  scope: ListingScope;
  listing: ListingInfo;
  established: number | null;
  languages: string[];
  studyModes: StudyMode[];
  campuses: Campus[];
  recognition: Recognition[];
  programs: Program[];
  /** Institution-wide fee facts. Programme fees live on the programme. */
  tuition: FeeFact[];
  scholarships: Scholarship[];
  admissions: {
    requirements: AdmissionRequirement[];
    deadlines: DeadlineFact[];
    links: OfficialLink[];
  };
  verification: InstitutionVerification;
  sources: SourceRef[];
  dataNotes: string[];
}

export interface InstitutionSummary {
  id: string;
  name: string;
  country: CountryRef;
  region: Region;
  city: string | null;
  website: string | null;
  scope: ListingScope;
  listing: ListingInfo;
  verificationLevel: 'source-checked' | 'directory-only';
  programs: {
    count: number;
    degreeLevels: DegreeLevel[];
    languages: string[];
    subjects: string[];
  };
  hasFeeFacts: boolean;
  hasRecognition: boolean;
  /** Which field matched the query: name, alternate name, city, country... */
  matchedOn: string | null;
}

export interface SearchWithheld {
  programDataUnknown: number;
  feeDataUnknown: number;
  languageUnknown: number;
}

export interface SearchResponse {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  items: InstitutionSummary[];
  scopeCounts: { university: number; education: number };
  withheld: SearchWithheld;
  notices: string[];
}

export interface Facets {
  countries: Array<{
    code: string;
    name: string;
    region: Region;
    universityRecords: number;
    sourceChecked: number;
  }>;
  subjects: Array<{ id: string; label: string; programCount: number; institutionCount: number }>;
  languages: Array<{ code: string; label: string; programCount: number }>;
  degreeLevels: Array<{ id: DegreeLevel; label: string; programCount: number }>;
  totals: CoverageStats['totals'];
}

export interface SourceInfo {
  id: string;
  name: string;
  publisher: string;
  url: string;
  license: string;
  licenseUrl: string;
  retrievedAt: string;
  release: string | null;
  use: string;
  limitations: string;
}

export interface CountryCoverage {
  code: string;
  name: string;
  region: Region;
  records: number;
  universityRecords: number;
  sourceChecked: number;
}

export interface CoverageStats {
  generatedAt: string;
  /** Date of the ROR release (or the latest directory snapshot). */
  directoryAsOf: string;
  sources: SourceInfo[];
  totals: {
    records: number;
    universityScope: number;
    educationScope: number;
    sourceChecked: number;
    programs: number;
    feeFacts: number;
    deadlineFacts: number;
    recognitionFacts: number;
    countries: number;
    universityCountries: number;
    cities: number;
    recordsWithCity: number;
    withDomains: number;
    /** Sourced claim count, excluding directory-only identity fields. */
    curatedFacts: number;
    officialSourcePages: number;
    officialSourceDomains: number;
    recordsWithRecognition: number;
    recordsWithFeeFacts: number;
  };
  countries: CountryCoverage[];
  gaps: string[];
  updateHistory: Array<{
    at: string;
    sources: Array<{ id: string; release: string | null; retrievedAt: string }>;
    totals: Record<string, number>;
    note: string;
  }>;
}

export interface FeeRate {
  from: string;
  to: string;
  rate: number;
  sourceUrl: string;
  sourceName: string;
  date: string;
}

/** Reserved for a future, explicitly dated FX table. Empty in this release. */
export interface FxTable {
  base: string;
  rates: FeeRate[];
  note: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  generatedAt: string | null;
  records: number;
  dataDir: string;
}

export interface ApiErrorBody {
  error: string;
  detail?: string;
}
