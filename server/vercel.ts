import path from 'node:path';
import { createApp } from './app';
import { loadData, type DataStore } from './data';
import { ReportStore, type ReportRepository } from './reports';
import { SupabaseReportStore, supabaseReportsConfigured } from './supabase-reports';

/**
 * Rebuild the request URL that Express should route when Vercel applies the
 * `/api/(.*)` -> `/api/index?__path=/$1` rewrite. Recent Vercel runtimes hand
 * the function the destination URL, so without this every API request would
 * look like `/api/index` and return the JSON 404. The helper is a no-op when
 * the original path is already present (local server, older runtimes).
 */
export function originalUrlFromRewrite(url: string): string {
  if (!url.includes('__path=')) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://vercel.local');
  } catch {
    return url;
  }
  const original = parsed.searchParams.get('__path');
  if (!original) return url;
  parsed.searchParams.delete('__path');
  const query = parsed.searchParams.toString();
  const pathname = original.startsWith('/') ? original : `/${original}`;
  return `${pathname}${query ? `?${query}` : ''}`;
}

function chooseReportStore(): ReportRepository {
  if (supabaseReportsConfigured()) return new SupabaseReportStore();
  // Vercel only allows writes under /tmp. Reports are best-effort there and
  // disappear with the instance; set the Supabase variables for durability.
  const directory = process.env.REPORT_STORE_DIR ?? path.join('/tmp', 'uniscope-reports');
  return new ReportStore(directory);
}

async function buildApp() {
  let store: DataStore | null = null;
  let dataError: Error | null = null;
  try {
    store = await loadData();
    console.info(
      `[vercel] loaded ${store.dataset.institutions.length.toLocaleString('en')} records ` +
        `from ${store.dataDir} (generated ${store.dataset.generatedAt})`,
    );
  } catch (error) {
    dataError = error instanceof Error ? error : new Error(String(error));
    console.error('[vercel] data could not be loaded:', dataError.message);
  }

  const reportStore = chooseReportStore();
  console.info(`[vercel] report storage: ${reportStore.kind}`);
  return createApp({ store, dataError, reportStore });
}

let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

/**
 * One app per function instance. The dataset and search index are built on the
 * first invocation and reused by warm invocations, so keep the memory/cold
 * start budget of the function in mind (see vercel.json).
 */
export function getServerApp(): Promise<ReturnType<typeof createApp>> {
  if (!appPromise) {
    appPromise = buildApp().catch((error: unknown) => {
      appPromise = null;
      throw error;
    });
  }
  return appPromise;
}
