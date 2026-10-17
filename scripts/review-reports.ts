import path from 'node:path';
import { ReportStore, type ReportStatus } from '../server/reports';

const args = process.argv.slice(2);
const statusIndex = args.indexOf('--status');
const status = statusIndex >= 0 ? (args[statusIndex + 1] as ReportStatus | undefined) : undefined;
const asJson = args.includes('--json');
const directory = path.resolve(process.env.REPORT_STORE_DIR ?? path.join(process.cwd(), 'data', 'runtime'));

const store = new ReportStore(directory);
const all = await store.list();
const reports = status ? all.filter((report) => report.status === status) : all;
const counts = all.reduce<Record<string, number>>((accumulator, report) => {
  accumulator[report.status] = (accumulator[report.status] ?? 0) + 1;
  return accumulator;
}, {});

if (asJson) {
  console.log(JSON.stringify({ counts, reports }, null, 2));
} else {
  console.log(
    `Correction reports in ${directory}: ${all.length} total` +
      (Object.keys(counts).length ? ` (${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(', ')})` : ''),
  );
  if (reports.length === 0) {
    console.log(status ? `No reports with status “${status}”.` : 'No reports yet.');
  }
  for (const report of reports) {
    console.log('');
    console.log(`[${report.status}] ${report.id.slice(0, 8)} · ${report.createdAt} · ${report.issueType}/${report.field}`);
    console.log(`  Institution: ${report.institutionName ?? report.institutionId ?? 'not specified'}`);
    if (report.pageUrl) console.log(`  Page: ${report.pageUrl}`);
    if (report.sourceUrl) console.log(`  Source: ${report.sourceUrl}`);
    if (report.email) console.log(`  Contact: ${report.email}`);
    console.log(`  ${report.details.replace(/\s+/g, ' ').slice(0, 500)}`);
  }
}
