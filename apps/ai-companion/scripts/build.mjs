import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  // The native host and its installer, which copies the host next to the launcher.
  entryPoints: {
    host: fileURLToPath(new URL('../src/main.ts', import.meta.url)),
    install: fileURLToPath(new URL('../src/install.ts', import.meta.url)),
  },
  outdir: fileURLToPath(new URL('../dist', import.meta.url)),
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // CommonJS dependencies (the file lock) need native Node require in the ESM bundle.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
