import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// `pnpm ai:install [--extension-id=ID]...`: the helper's own installer in development mode.
const cli = fileURLToPath(new URL('../dist/cli.mjs', import.meta.url));
if (!existsSync(cli)) {
  console.error('Build the helper app first: pnpm ai:build');
  process.exit(1);
}
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const { status } = spawnSync(process.execPath, [cli, 'install', '--dev', ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
