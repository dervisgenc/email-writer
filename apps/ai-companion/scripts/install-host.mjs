import { access } from 'node:fs/promises';

// The installer (src/install.ts) is bundled next to the host by `pnpm ai:build`.
const installer = new URL('../dist/install.mjs', import.meta.url);
try {
  await access(installer);
} catch {
  console.error('Build the helper app first: pnpm ai:build');
  process.exit(1);
}
await import(installer.href);
