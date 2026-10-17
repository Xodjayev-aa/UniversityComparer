import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CoverageStats } from '../shared/types';
import { renderCoverageMarkdown } from './lib/coverage';

const dataDir = path.resolve(process.env.UNISCOPE_DATA_DIR ?? path.join(process.cwd(), 'data', 'build'));
const output = path.join(process.cwd(), 'docs', 'COVERAGE.md');

try {
  const coverage = JSON.parse(await readFile(path.join(dataDir, 'coverage.json'), 'utf8')) as CoverageStats;
  await writeFile(output, renderCoverageMarkdown(coverage), 'utf8');
  console.log(`Wrote ${output} from ${path.join(dataDir, 'coverage.json')}`);
} catch (error) {
  console.error(`Could not write the coverage document: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
