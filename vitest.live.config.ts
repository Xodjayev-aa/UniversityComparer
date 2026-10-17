import { defineConfig } from 'vitest/config';

/**
 * Live-source checks are deliberately separate from the mocked suite.
 * They open real directory/authority pages and are rate-limited by hand.
 * Run with: NODE_EXTRA_CA_CERTS=… npm run test:live
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
