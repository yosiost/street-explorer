import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Every file under public/, as paths relative to it. */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? publicFiles(path) : [relative('public', path)];
  });
}

/**
 * Emits sw.js from pwa/sw.js with the list of files to cache for offline use. The version
 * is a hash of everything cached, so any change makes browsers pick up the new files.
 */
function serviceWorker(): Plugin {
  return {
    name: 'street-explorer-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const files = [...new Set(['index.html', ...built, ...publicFiles()])].sort();
      const hash = createHash('sha256');
      for (const f of built) hash.update(f);
      for (const f of publicFiles()) hash.update(readFileSync(join('public', f)));
      const source = readFileSync('pwa/sw.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base so dist/ works from any path (e.g. GitHub Pages project sites).
  base: './',
  plugins: [serviceWorker()],
  // Fixed ports so this app never lands on another project's dev server.
  server: { port: 5180, strictPort: true },
  preview: { port: 4179, strictPort: true },
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
