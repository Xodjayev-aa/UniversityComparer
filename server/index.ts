import { createApp } from './app';
import { loadData, type DataStore } from './data';

const PORT = Number(process.env.PORT ?? (process.env.NODE_ENV === 'production' ? 3000 : 8787));
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  let store: DataStore | null = null;
  let dataError: Error | null = null;
  try {
    store = await loadData({ dataDir: process.env.UNISCOPE_DATA_DIR });
    console.info(
      `[server] loaded ${store.dataset.institutions.length.toLocaleString('en')} records ` +
        `(${store.coverage.totals.sourceChecked.toLocaleString('en')} source-checked) from ${store.dataDir}`,
    );
    console.info(`[server] dataset generated ${store.dataset.generatedAt}; directory data as of ${store.dataset.directoryAsOf}`);
  } catch (error) {
    dataError = error instanceof Error ? error : new Error(String(error));
    console.error('[server] data could not be loaded:', dataError.message);
  }

  const app = createApp({ store, dataError });
  const server = app.listen(PORT, HOST, () => {
    console.info(`[server] UniScope listening on http://${HOST}:${PORT} (${process.env.NODE_ENV ?? 'development'})`);
    if (!store) console.warn('[server] API data endpoints will return 503 until a dataset is available.');
  });

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.info(`[server] received ${signal}; closing…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('[server] failed to start:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
