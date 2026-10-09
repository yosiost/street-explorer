import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so dist/ works from any path (e.g. GitHub Pages project sites).
  base: './',
  // Fixed ports so this app never lands on another project's dev server.
  server: { port: 5180, strictPort: true },
  preview: { port: 4179, strictPort: true },
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
