import type { CoverageStats, Institution, SourceInfo } from '../../shared/types';
import { subjectLabel } from '../../shared/taxonomy';

export interface HistoryEntry {
  at: string;
  sources: Array<{ id: string; release: string | null; retrievedAt: string }>;
  totals: Record<string, number>;
  note: string;
}

export function buildCoverage(options: {
  records: Institution[];
  sources: SourceInfo[];
  generatedAt: string;
  directoryAsOf: string;
  history: HistoryEntry[];
}): CoverageStats {
  const { records, sources, generatedAt, directoryAsOf, history } = options;
  const countries = new Map<string, { name: string; region: Institution['region']; records: number; universityRecords: number; sourceChecked: number }>();
  const cities = new Set<string>();
  const officialPages = new Set<string>();
  const officialDomains = new Set<string>();
  let programs = 0;
  let feeFacts = 0;
  let deadlineFacts = 0;
  let recognitionFacts = 0;
  let sourceChecked = 0;
  let recordswithCity = 0;
  let withDomains = 0;
  let recordsWithRecognition = 0;
  let recordsWithFeeFacts = 0;
  let curatedFacts = 0;

  for (const record of records) {
    const country = countries.get(record.country.code) ?? {
      name: record.country.name,
      region: record.region,
      records: 0,
      universityRecords: 0,
      sourceChecked: 0,
    };
    country.records += 1;
    if (record.scope === 'university') country.universityRecords += 1;
    if (record.verification.level === 'source-checked') {
      country.sourceChecked += 1;
      sourceChecked += 1;
      curatedFacts += record.verification.checkedFacts;
      for (const source of record.sources) {
        if (!source.url.startsWith('https://ror.org/') && !source.url.includes('github.com/Hipo')) {
          officialPages.add(source.url);
          try {
            officialDomains.add(new URL(source.url).hostname.replace(/^www\./, ''));
          } catch {
            // ignore invalid URL here; schema validation already rejects it
          }
        }
      }
    }
    countries.set(record.country.code, country);

    const city = record.locations.find((location) => location.city)?.city;
    if (city) {
      recordswithCity += 1;
      cities.add(city);
    }
    if (record.domains.length > 0) withDomains += 1;

    const recordFees =
      record.tuition.length + record.programs.reduce((sum, program) => sum + program.tuition.length, 0);
    const recordDeadlines =
      record.admissions.deadlines.length +
      record.programs.reduce((sum, program) => sum + program.deadlines.length, 0);
    programs += record.programs.length;
    feeFacts += recordFees;
    deadlineFacts += recordDeadlines;
    recognitionFacts += record.recognition.length;
    if (record.recognition.length > 0) recordsWithRecognition += 1;
    if (recordFees > 0) recordsWithFeeFacts += 1;
  }

  const countryList = [...countries.entries()]
    .map(([code, value]) => ({
      code,
      name: value.name,
      region: value.region,
      records: value.records,
      universityRecords: value.universityRecords,
      sourceChecked: value.sourceChecked,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const universityScope = records.filter((record) => record.scope === 'university').length;
  const educationScope = records.length - universityScope;
  const rawPercentage = universityScope > 0 ? (sourceChecked / universityScope) * 100 : 0;
  const percentage =
    rawPercentage === 0 ? '0' : rawPercentage < 0.1 ? 'under 0.1' : rawPercentage.toFixed(1);
  const subjectCount = new Set(records.flatMap((record) => record.programs.map((program) => program.subjectArea))).size;

  const gaps = [
    `This is not a complete world register. It contains ${records.length.toLocaleString('en')} directory records from the sources listed below; other universities and education organisations are certainly missing.`,
    `Source-checked programme, fee, deadline, scholarship and recognition facts exist for ${sourceChecked.toLocaleString('en')} of ${universityScope.toLocaleString('en')} university-scope records (${percentage}%). The rest are discovery records only.`,
    `Directory inclusion is not university status, accreditation or degree-granting authority. ${educationScope.toLocaleString('en')} education records are kept in the broader “education” scope because they are neither in the Hipo university directory nor named like a university.`,
    `“University scope” combines the community Hipo university directory with a multilingual name heuristic for ROR records. It can include organisations that are not universities and can miss universities with unusual names.`,
    `Hipo is a community-maintained directory, not an official register. It may contain non-university institutions and may be out of date. Its entries are labelled as community directory listings.`,
    `A record needs a row in ROR or Hipo. Institutions absent from both are not listed even when they have an official website; for example, Webster University in Tashkent was confirmed to exist during verification but is not in this build.`,
    `No currency conversion is applied in this release. Fees are shown in their original currency and cannot be compared across currencies without a dated exchange-rate source.`,
    `Recognition and accreditation are shown only where an official university or authority page was read. Absence of a recognition entry is not evidence that an institution is unaccredited (${recordsWithRecognition.toLocaleString('en')} record${recordsWithRecognition === 1 ? '' : 's'} currently have one or more entries).`,
    `Cities are missing for ${(records.length - recordswithCity).toLocaleString('en')} records. No city is inferred from a domain, a postal address or another institution.`,
    `${cities.size.toLocaleString('en')} distinct city strings are recorded; these are source spellings, not a normalised world city list.`,
    `Programme catalogues are selective samples of official pages. A missing programme is not a finding that it is not offered, and a listed programme does not guarantee admission.`,
    `Former names are included only when a source names them. Local-script and alternate names come from the directory sources and are not complete.`,
    `Deadline dates can change and are shown with the source's own wording and the date the page was read. UniScope does not monitor pages continuously.`,
    `The subject classification is UniScope’s own grouping, not a national, accreditation or publisher taxonomy; ${subjectCount} of the taxonomy’s subject areas currently have at least one programme fact.`,
    `No ranking is produced. Publisher rankings are not mixed, and no overall quality, personal-fit or admission-chance score is calculated.`,
  ];

  return {
    generatedAt,
    directoryAsOf,
    sources,
    totals: {
      records: records.length,
      universityScope,
      educationScope,
      sourceChecked,
      programs,
      feeFacts,
      deadlineFacts,
      recognitionFacts,
      countries: countryList.length,
      universityCountries: countryList.filter((country) => country.universityRecords > 0).length,
      cities: cities.size,
      recordsWithCity: recordswithCity,
      withDomains,
      curatedFacts,
      officialSourcePages: officialPages.size,
      officialSourceDomains: officialDomains.size,
      recordsWithRecognition,
      recordsWithFeeFacts,
    },
    countries: countryList,
    gaps,
    updateHistory: history,
  };
}

export function renderCoverageMarkdown(coverage: CoverageStats): string {
  const lines: string[] = [];
  lines.push('# UniScope coverage and sources');
  lines.push('');
  lines.push('> Generated from the current dataset. Counts describe this build only; they are not a claim of completeness.');
  lines.push('');
  lines.push(`- Generated: ${coverage.generatedAt}`);
  lines.push(`- Directory data as of: ${coverage.directoryAsOf}`);
  lines.push(`- Records: ${coverage.totals.records.toLocaleString('en')}`);
  lines.push(`- University-scope records: ${coverage.totals.universityScope.toLocaleString('en')}`);
  lines.push(`- Broader education records: ${coverage.totals.educationScope.toLocaleString('en')}`);
  lines.push(`- Source-checked profiles: ${coverage.totals.sourceChecked.toLocaleString('en')}`);
  lines.push(`- Programme facts: ${coverage.totals.programs.toLocaleString('en')}`);
  lines.push(`- Fee facts: ${coverage.totals.feeFacts.toLocaleString('en')}`);
  lines.push(`- Deadline facts: ${coverage.totals.deadlineFacts.toLocaleString('en')}`);
  lines.push(`- Recognition facts: ${coverage.totals.recognitionFacts.toLocaleString('en')}`);
  lines.push(`- Official source pages read: ${coverage.totals.officialSourcePages.toLocaleString('en')}`);
  lines.push(`- Curated facts: ${coverage.totals.curatedFacts.toLocaleString('en')}`);
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  for (const source of coverage.sources) {
    lines.push(`### ${source.name}`);
    lines.push('');
    lines.push(`- Publisher: ${source.publisher}`);
    lines.push(`- URL: ${source.url}`);
    lines.push(`- Release: ${source.release ?? 'Not stated'}`);
    lines.push(`- Retrieved: ${source.retrievedAt}`);
    lines.push(`- Licence: ${source.license} (${source.licenseUrl})`);
    lines.push(`- Use: ${source.use}`);
    lines.push(`- Limitations: ${source.limitations}`);
    lines.push('');
  }
  lines.push('## Known gaps');
  lines.push('');
  for (const gap of coverage.gaps) lines.push(`- ${gap}`);
  lines.push('');
  lines.push('## Country coverage');
  lines.push('');
  lines.push('| Country / territory | Region | Records | University-scope | Source-checked |');
  lines.push('| --- | --- | ---: | ---: | ---: |');
  for (const country of coverage.countries) {
    lines.push(
      `| ${country.name} (${country.code}) | ${country.region} | ${country.records} | ${country.universityRecords} | ${country.sourceChecked} |`,
    );
  }
  lines.push('');
  lines.push('## Update history');
  lines.push('');
  if (coverage.updateHistory.length === 0) {
    lines.push('_No history entries in this build._');
  } else {
    for (const entry of coverage.updateHistory) {
      lines.push(`### ${entry.at}`);
      lines.push('');
      lines.push(entry.note);
      lines.push('');
      lines.push(
        entry.sources
          .map((source) => `- ${source.id}: ${source.release ?? 'no release label'} (retrieved ${source.retrievedAt})`)
          .join('\n'),
      );
      lines.push('');
    }
  }
  lines.push('');
  lines.push(
    'Subject labels: ' +
      [...new Set(coverage.gaps.filter((gap) => gap.startsWith('The subject classification')))]
        .map(() => 'UniScope taxonomy')
        .join(', ') +
      '.',
  );
  lines.push('');
  lines.push('This document is generated; do not edit it by hand.');
  return lines.join('\n');
}

export function coverageSubjectSummary(records: Institution[]): string {
  return [...new Set(records.flatMap((record) => record.programs.map((program) => subjectLabel(program.subjectArea))))]
    .sort()
    .join(', ');
}
