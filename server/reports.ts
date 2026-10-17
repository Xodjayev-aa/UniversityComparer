import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'rejected';

export interface CorrectionReport {
  id: string;
  createdAt: string;
  status: ReportStatus;
  issueType: 'incorrect' | 'outdated' | 'missing' | 'source-problem' | 'other';
  field: string;
  details: string;
  institutionId: string | null;
  institutionName: string | null;
  pageUrl: string | null;
  sourceUrl: string | null;
  email: string | null;
}

export type NewReport = Pick<
  CorrectionReport,
  'issueType' | 'field' | 'details' | 'institutionId' | 'institutionName' | 'pageUrl' | 'sourceUrl' | 'email'
>;

/**
 * The small surface the API needs from a review queue. The local server uses a
 * JSONL file; serverless deployments use Supabase so reports survive cold
 * starts and are shared by every function instance.
 */
export interface ReportRepository {
  readonly kind: string;
  append(input: NewReport): Promise<CorrectionReport>;
  list(): Promise<CorrectionReport[]>;
  update(id: string, patch: { status?: ReportStatus; note?: string }): Promise<CorrectionReport | null>;
}

/**
 * A deliberately small JSONL queue. It is not durable on ephemeral hosts;
 * deploy with a persistent volume or export the queue before scaling.
 */
export class ReportStore implements ReportRepository {
  readonly kind = 'file';
  private readonly filePath: string;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(directory: string) {
    this.filePath = path.join(directory, 'reports.jsonl');
  }

  private async ensure(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async append(input: NewReport): Promise<CorrectionReport> {
    await this.ensure();
    const report: CorrectionReport = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'new',
      ...input,
    };
    this.writeQueue = this.writeQueue.then(() =>
      appendFile(this.filePath, `${JSON.stringify(report)}\n`, 'utf8'),
    );
    await this.writeQueue;
    return report;
  }

  async list(): Promise<CorrectionReport[]> {
    await this.ensure();
    let raw = '';
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch {
      return [];
    }
    const reports: CorrectionReport[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as CorrectionReport;
        if (parsed?.id && parsed?.createdAt) reports.push(parsed);
      } catch {
        // Skip a corrupted line rather than taking down the review queue.
      }
    }
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async update(
    id: string,
    patch: { status?: ReportStatus; note?: string },
  ): Promise<CorrectionReport | null> {
    await this.ensure();
    const reports = await this.list();
    const index = reports.findIndex((report) => report.id === id);
    if (index === -1) return null;
    const existing = reports[index]!;
    const updated: CorrectionReport = {
      ...existing,
      status: patch.status ?? existing.status,
    };
    reports[index] = updated;
    const body = reports.map((report) => JSON.stringify(report)).join('\n');
    const temporary = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, `${body}\n`, 'utf8');
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
    return updated;
  }
}
