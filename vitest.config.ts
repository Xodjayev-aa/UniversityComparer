import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/server/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    reporters: ['default'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
