import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Integration tests share one MongoDB database; running files in parallel
    // would let one file's cleanup wipe another's fixtures mid-test.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
