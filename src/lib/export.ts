import type { Institution } from '../../shared/types';
import type { SavedInstitution } from './storage';
import type { ComparisonResult, CompareOptions } from './compare';
import { formatDate, formatFeeAmount, sourceAge } from './format';
import { APPLICANT_LABELS, DEGREE_LABELS, FEE_COVERAGE_LABELS, subjectLabel } from '../../shared/taxonomy';
import { verificationInfo } from './labels';

function markdownCell(value: string | null | undefined): string {
  return (value ?? 'Not available').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildShortlistCsv(items: SavedInstitution[], includeNotes = false): string {
  const headers = [
    'Name',
    'Country',
    'City',
    'Verification',
    'Scope basis',
    'Saved at',
    'Website',
    'Source-checked programmes',
    'Has source-checked fee data',
    ...(includeNotes ? ['Private notes'] : []),
  ];
  const rows = items.map((item) => [
    item.summary.name,
    item.summary.country.name,
    item.summary.city ?? 'Not available',
    verificationInfo(item.summary.verificationLevel === 'source-checked' ? 'official-source-checked' : 'directory-only').label,
    item.summary.verificationLevel,
    item.savedAt.slice(0, 10),
    item.summary.website ?? 'Not available',
    item.summary.programs.count,
    item.summary.hasFeeFacts ? 'yes' : 'no source-checked fee fact',
    ...(includeNotes ? [item.notes] : []),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function buildShortlistMarkdown(items: SavedInstitution[], includeNotes = false): string {
  const lines = [
    '# UniScope shortlist',
    '',
    `Exported ${new Date().toISOString().slice(0, 10)} from local shortlist data.`,
    'Saving is local to this browser. This export is a snapshot, not a live check.',
    includeNotes
      ? '**Private notes are included in this file. Do not share it publicly unless you intend to.**'
      : 'Private notes are not included.',
    '',
  ];
  for (const item of items) {
    lines.push(`## ${item.summary.name}`);
    lines.push('');
    lines.push(`- Country: ${item.summary.country.name}`);
    lines.push(`- City: ${item.summary.city ?? 'Not available'}`);
    lines.push(`- Verification: ${item.summary.verificationLevel === 'source-checked' ? 'Source-checked profile' : 'Directory record only'}`);
    lines.push(`- Saved: ${formatDate(item.savedAt.slice(0, 10))}`);
    lines.push(`- Website: ${item.summary.website ?? 'Not available'}`);
    lines.push(
      `- Source-checked programmes: ${item.summary.programs.count === 0 ? 'None in this release' : item.summary.programs.count}`,
    );
    lines.push(`- Source-checked fee data: ${item.summary.hasFeeFacts ? 'Yes (see profile)' : 'Not available'}`);
    if (includeNotes && item.notes.trim()) {
      lines.push('');
      lines.push('**Private note:**');
      lines.push('');
      lines.push(item.notes.trim());
    }
    lines.push('');
  }
  lines.push('---');
  lines.push(
    'UniScope does not rank universities by quality and does not promise admission, scholarships, visas or credential recognition. Always check official pages. Missing data is not zero.',
  );
  return lines.join('\n');
}

export function buildComparisonMarkdown(
  records: Institution[],
  result: ComparisonResult,
  options: CompareOptions,
): string {
  const lines = [
    '# UniScope comparison',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)}. This file contains public profile data only — no private notes.`,
    '',
    `Priority: ${options.priority}. Applicant category: ${APPLICANT_LABELS[options.applicantCategory]}.`,
    options.subject ? `Subject: ${subjectLabel(options.subject)}.` : 'Subject: any.',
    options.degree ? `Degree: ${DEGREE_LABELS[options.degree]}.` : 'Degree: not selected.',
    '',
    `## Outcome`,
    '',
    `**${result.outcome.title}**`,
    '',
    result.outcome.detail,
    '',
  ];

  if (result.costBasis) {
    lines.push(
      `Cost basis: ${APPLICANT_LABELS[result.costBasis.applicantCategory]}, ${DEGREE_LABELS[result.costBasis.degree]}, ${result.costBasis.academicYear}, ${FEE_COVERAGE_LABELS[result.costBasis.coverage as keyof typeof FEE_COVERAGE_LABELS] ?? result.costBasis.coverage}, currency ${result.costBasis.currency}.`,
      '',
    );
  }

  lines.push('## Side by side', '');
  lines.push(`| Field | ${records.map((record) => markdownCell(record.names.primary)).join(' | ')} |`);
  lines.push(`| --- | ${records.map(() => '---').join(' | ')} |`);
  const row = (label: string, values: string[]) => {
    lines.push(`| ${markdownCell(label)} | ${values.map(markdownCell).join(' | ')} |`);
  };

  row('Country', records.map((record) => record.country.name));
  row('City', records.map((record) => record.locations.find((l) => l.city)?.city ?? 'Not available'));
  row(
    'Verification',
    records.map((record) =>
      record.verification.level === 'source-checked'
        ? `Source-checked${record.verification.lastCheckedAt ? ` (read ${formatDate(record.verification.lastCheckedAt)})` : ''}`
        : 'Directory record only',
    ),
  );
  row('Teaching languages', records.map((record) => record.languages.join(', ') || 'Not available'));
  row('Programmes', records.map((record) => (record.programs.length ? `${record.programs.length} source-checked` : 'Not available')));
  row('Recognition', records.map((record) => (record.recognition.length ? `${record.recognition.length} source-checked entr${record.recognition.length === 1 ? 'y' : 'ies'}` : 'Not available')));

  const feeValues = result.evaluations.map((evaluation) => {
    if (!evaluation.selectedFee) return evaluation.feeNotComparableReason ?? 'Not available';
    const { fee, program } = evaluation.selectedFee;
    return `${formatFeeAmount(fee.amount)} (${fee.academicYear}, ${APPLICANT_LABELS[fee.applicantCategory]}, ${fee.unit}${program ? `, ${program.name}` : ', institution-wide'})`;
  });
  row('Annual fee (selected basis)', feeValues);

  const matchingValues = result.evaluations.map((evaluation) => {
    if (evaluation.programData === 'unavailable') return 'Programme data not available';
    if (evaluation.matchingPrograms.length === 0) return 'No matching programme listed';
    return evaluation.matchingPrograms.map((program) => program.name).join('; ');
  });
  row('Matching programmes', matchingValues);

  const lastChecked = records.map((record) =>
    record.verification.lastCheckedAt
      ? `${formatDate(record.verification.lastCheckedAt)} (${sourceAge(record.verification.lastCheckedAt)})`
      : 'Not source-checked',
  );
  row('Last source read', lastChecked);

  lines.push('', '## Trade-offs', '');
  for (const tradeoff of result.tradeoffs) {
    const record = records.find((item) => item.id === tradeoff.institutionId);
    lines.push(`### ${record?.names.primary ?? tradeoff.institutionId}`);
    for (const text of tradeoff.texts) lines.push(`- ${text}`);
    lines.push('');
  }

  lines.push('## Data gaps and limits', '');
  for (const gap of result.gaps) lines.push(`- ${gap}`);
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  for (const record of records) {
    lines.push(`### ${record.names.primary}`);
    for (const source of record.sources.slice(0, 12)) {
      lines.push(
        `- ${source.title}: ${source.url} (${source.publisher ?? 'publisher not recorded'}; read ${formatDate(source.retrievedAt)})`,
      );
    }
    if (record.sources.length > 12) lines.push(`- ${record.sources.length - 12} more sources on the UniScope profile.`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    'No overall university-quality score is produced. Recommendations use only the dimensions shown and do not predict admission, scholarships, visas or recognition. Missing data is not zero or poor performance.',
  );
  return lines.join('\n');
}

export function downloadText(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function exportFilename(prefix: string, extension: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
