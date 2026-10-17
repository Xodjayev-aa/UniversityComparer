import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Institution, SourceInfo } from '../../shared/types';
import { institutionDatasetSchema } from '../../shared/schema';
import { buildDirectory } from './directory';
import { parseHipoJson, parseRorZip } from './parse';
import { applyResearchFiles, loadResearchFiles } from './research';
import { ensureHipoJson, ensureRorZip, sourceInfoForRun } from './sources';
import { buildCoverage, renderCoverageMarkdown, type HistoryEntry } from '../lib/coverage';

interface Options {
  offline: boolean;
  refresh: boolean;
  noHistory: boolean;
}

function parseArgs(argv: string[]): Options {
  return {
    offline: argv.includes('--offline'),
    refresh: argv.includes('--refresh'),
    noHistory: argv.includes('--no-history'),
  };
}

function human(n: number): string {
  return n.toLocaleString('en');
}

async function writeAtomic(filePath: string, contents: string | Buffer): Promise<void> {
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, filePath);
}

async function readHistory(filePath: string): Promise<HistoryEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is HistoryEntry =>
        Boolean(entry) && typeof entry === 'object' && typeof (entry as HistoryEntry).at === 'string',
    );
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const options = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const cacheDir = path.join(root, 'data', 'build', '.cache');
  const researchDir = path.join(root, 'data', 'research');
  const outputDir = path.join(root, 'data', 'build');
  const docsDir = path.join(root, 'docs');
  await mkdir(cacheDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(researchDir, { recursive: true });

  console.info('[ingest] fetching/validating directory sources…');
  const ror = await ensureRorZip({ cacheDir, refresh: options.refresh, offline: options.offline });
  const hipo = await ensureHipoJson({ cacheDir, refresh: options.refresh, offline: options.offline });
  const sources: SourceInfo[] = [sourceInfoForRun('ror', ror), sourceInfoForRun('hipo', hipo)];
  console.info(`[ingest] ROR ${ror.release} (retrieved ${ror.retrievedAt}); Hipo ${hipo.release}`);

  console.info('[ingest] parsing ROR data dump…');
  const parsedRor = await parseRorZip(ror.path);
  console.info(`[ingest] ROR records: ${human(parsedRor.organisations.length)}; schema ${parsedRor.schemaVersions.join(', ') || 'unknown'}`);
  const hipoEntries = await parseHipoJson(hipo.path);
  console.info(`[ingest] Hipo entries: ${human(hipoEntries.length)}`);

  console.info('[ingest] normalising and de-duplicating directory records…');
  const directory = buildDirectory(parsedRor.organisations, hipoEntries, ror, hipo);
  console.info(
    `[ingest] ROR active education: ${human(directory.activeEducation)}; mapped: ${human(directory.rorCount)}; ` +
      `Hipo-only: ${human(directory.hipoOnly)}; merged: ${human(directory.merged)}`,
  );
  console.info(
    `[ingest] ${human(directory.records.length)} records: ${human(directory.universityScope)} university scope, ${human(directory.educationScope)} broader education`,
  );

  console.info('[ingest] applying reviewed research files…');
  const research = await loadResearchFiles(researchDir);
  let records: Institution[] = directory.records;
  let profiles = 0;
  let facts = 0;
  if (research.research.length === 0) {
    console.warn(
      '[ingest] WARNING: data/research contains no research files. All records will be directory-only; ' +
        'no programmes, fees, deadlines or recognition will be claimed.',
    );
  } else {
    const applied = applyResearchFiles(records, research.research);
    records = applied.records;
    profiles = applied.profiles;
    facts = applied.facts;
    if (applied.warnings.length > 0) {
      for (const warning of applied.warnings) console.warn(`[ingest] WARNING: ${warning}`);
    }
    console.info(
      `[ingest] research files: ${human(research.files.length)}; source-checked profiles: ${human(profiles)}; sourced facts: ${human(facts)}`,
    );
  }

  records.sort((a, b) => a.country.name.localeCompare(b.country.name, 'en') || a.names.primary.localeCompare(b.names.primary, 'en') || a.id.localeCompare(b.id));

  const generatedAt = new Date().toISOString();
  const directoryAsOf = ror.publishedAt ?? ror.retrievedAt;
  const dataset = {
    schemaVersion: 1 as const,
    generatedAt,
    directoryAsOf,
    sources,
    institutions: records,
  };

  console.info('[ingest] validating the complete dataset…');
  const validated = institutionDatasetSchema.safeParse(dataset);
  if (!validated.success) {
    console.error(`[ingest] dataset validation failed with ${validated.error.issues.length} issue(s):`);
    for (const issue of validated.error.issues.slice(0, 25)) {
      console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    if (validated.error.issues.length > 25) {
      console.error(`  … ${validated.error.issues.length - 25} more`);
    }
    process.exitCode = 1;
    return;
  }

  const json = JSON.stringify(dataset);
  const gzip = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const datasetPath = path.join(outputDir, 'institutions.json.gz');
  await writeAtomic(datasetPath, gzip);
  // Remove an older uncompressed artifact if one is present; the server reads
  // the gzip file, and .json would otherwise be a stale second source of truth.
  await unlink(path.join(outputDir, 'institutions.json')).catch(() => undefined);

  const historyPath = path.join(outputDir, 'history.json');
  const history = options.noHistory ? await readHistory(historyPath) : await readHistory(historyPath);
  let coverageSourceCounts: HistoryEntry['totals'] = {};
  if (!options.noHistory) {
    const coveragePreview = buildCoverage({
      records,
      sources,
      generatedAt,
      directoryAsOf,
      history: [],
    });
    coverageSourceCounts = {
      records: coveragePreview.totals.records,
      universityScope: coveragePreview.totals.universityScope,
      sourceChecked: coveragePreview.totals.sourceChecked,
      programs: coveragePreview.totals.programs,
      feeFacts: coveragePreview.totals.feeFacts,
    };
    const day = generatedAt.slice(0, 10);
    const withoutSameDay = history.filter((entry) => entry.at.slice(0, 10) !== day);
    withoutSameDay.push({
      at: generatedAt,
      sources: sources.map((source) => ({
        id: source.id,
        release: source.release,
        retrievedAt: source.retrievedAt,
      })),
      totals: coverageSourceCounts,
      note: `Directory sources: ROR ${ror.release}; Hipo ${hipo.release}. ${human(records.length)} records, ${human(directory.universityScope)} university-scope, ${human(profiles)} source-checked profiles.`,
    });
    history.splice(0, history.length, ...withoutSameDay);
  }
  const trimmedHistory = history.slice(-50);
  await writeAtomic(historyPath, `${JSON.stringify(trimmedHistory, null, 2)}\n`);

  const coverage = buildCoverage({
    records,
    sources,
    generatedAt,
    directoryAsOf,
    history: trimmedHistory,
  });
  await writeAtomic(path.join(outputDir, 'coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`);
  await writeAtomic(path.join(docsDir, 'COVERAGE.md'), `${renderCoverageMarkdown(coverage)}\n`);

  const datasetMb = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);
  const gzipMb = (gzip.length / 1024 / 1024).toFixed(2);
  const withCity = records.filter((record) => record.locations.some((location) => location.city)).length;
  const withDomain = records.filter((record) => record.domains.length > 0).length;
  console.info(
    `[ingest] wrote ${datasetPath} (${datasetMb} MB JSON → ${gzipMb} MB gzip), coverage.json, history.json, docs/COVERAGE.md`,
  );
  console.info(
    `[ingest] coverage: ${human(coverage.totals.records)} records; ${human(coverage.totals.universityScope)} university-scope; ` +
      `${human(coverage.totals.sourceChecked)} source-checked; ${human(coverage.totals.programs)} programmes; ` +
      `${human(coverage.totals.feeFacts)} fee facts; ${human(coverage.totals.countries)} countries; ` +
      `${human(withCity)} with a city; ${human(withDomain)} with a domain`,
  );
  if (coverage.totals.sourceChecked === 0) {
    console.warn('[ingest] NOTE: this build has zero source-checked profiles. That is visible in the app and coverage document.');
  }
  console.info(`[ingest] finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((error: unknown) => {
  console.error('[ingest] failed:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
