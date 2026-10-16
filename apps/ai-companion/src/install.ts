import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { findClaudeBinary } from '@email-writer/ai-claude-code';

import { parseInstallArguments, planInstall, planUninstall } from './install-plan';
import { hostPlatform } from './platform';

/** Registers the native host with one browser, or removes that registration (`--uninstall`). */
async function main(): Promise<void> {
  const { browser, extensionId, uninstall } = parseInstallArguments(process.argv.slice(2));
  const platform = hostPlatform();
  if (uninstall) {
    const plan = planUninstall(platform, browser);
    for (const key of plan.registryKeys) await platform.registry?.remove(key);
    for (const file of plan.files) await rm(file, { force: true });
    process.stdout.write(
      'Native host registration removed. Sign out in the extension before uninstalling to revoke tokens. ' +
        `Local credentials remain in ${platform.credentialsDirectory}.\n`,
    );
    return;
  }
  // Read first: a missing build fails before any registration changes.
  const host = await readFile(new URL('./host.mjs', import.meta.url), 'utf8');
  // pnpm puts the workspace's node_modules/.bin first in PATH; those are not user installations.
  const claude = await findClaudeBinary(
    platform.claudeLocations.filter((location) => !location.split(/[\\/]/).includes('node_modules')),
  );
  const claudePath = claude.ok && claude.value.args.length === 0 ? claude.value.file : null;
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  const plan = planInstall(platform, {
    browser,
    extensionId,
    node: process.execPath,
    host,
    claudePath,
    claudeConfigDir,
  });
  for (const directory of plan.directories)
    await mkdir(directory.path, { recursive: true, mode: directory.mode });
  for (const file of plan.files) {
    await writeFile(file.path, file.content, { mode: file.mode });
    await chmod(file.path, file.mode);
  }
  for (const entry of plan.registry) await platform.registry?.set(entry.key, entry.value);

  const { manifest, registryKey } = platform.registration(browser);
  const claudeState =
    claudePath ??
    (!claude.ok && claude.error.code === 'AI_CLAUDE_UNSUPPORTED_INSTALL'
      ? 'only a claude.cmd script was found, which cannot be started safely (install Claude Code with the native installer)'
      : 'not found (install it and run this command again to use it)');
  process.stdout.write(
    `Installed for ${browser}: ${manifest}\n` +
      (registryKey ? `Registry: ${registryKey}\n` : '') +
      `Claude Code: ${claudeState}` +
      (claudeConfigDir ? ` · configuration: ${claudeConfigDir}` : '') +
      '\nRestart the extension, then open Settings → AI connection.\n',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
