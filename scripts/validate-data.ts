import { loadData } from '../server/data';

try {
  const store = await loadData({ validate: true });
  const { totals } = store.coverage;
  console.log(
    [
      `Dataset OK: ${store.dataset.institutions.length.toLocaleString('en')} records`,
      `${totals.universityScope.toLocaleString('en')} university-scope`,
      `${totals.sourceChecked.toLocaleString('en')} source-checked profiles`,
      `${totals.programs.toLocaleString('en')} programmes`,
      `${totals.feeFacts.toLocaleString('en')} fee facts`,
      `${totals.countries.toLocaleString('en')} countries`,
      `generated ${store.dataset.generatedAt}`,
      `directory data as of ${store.dataset.directoryAsOf}`,
    ].join(' · '),
  );
  if (totals.sourceChecked === 0) {
    console.warn(
      'Warning: no source-checked profiles. Programme, fee, deadline and recognition facts will be absent.',
    );
  }
  console.log(`Data directory: ${store.dataDir}`);
} catch (error) {
  console.error(`Dataset validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
