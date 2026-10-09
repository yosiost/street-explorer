import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so dist/ works from any path (e.g. GitHub Pages project sites).
  base: './',
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
