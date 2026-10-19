import { isSea } from 'node:sea';

import { runHost } from './host';
import { configuredPlatform, install, removeLeftovers, status, uninstall } from './install';
import { parseCommand, USAGE } from './install-plan';
import { hostPlatform } from './platform';
import { HOST_VERSION } from './version';

/**
 * The helper app's single entry point. Browsers start it as their native messaging host;
 * in a terminal it installs, removes or describes itself. The release build is one program
 * (Node.js single executable application); a development build is this script run by Node.js.
 */
async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2), process.stdin.isTTY === true);
  switch (command.kind) {
    case 'host': {
      const { platform, config } = await configuredPlatform();
      void removeLeftovers(platform);
      runHost(platform, config);
      return;
    }
    case 'install':
      await install(hostPlatform(), {
        extensionIds: command.extensionIds,
        development: command.development,
        source: isSea()
          ? { program: process.execPath }
          : { script: process.argv[1] ?? '', node: process.execPath },
      });
      return;
    case 'uninstall':
      await uninstall(hostPlatform(), {
        deleteData: command.deleteData,
        runningProgram: isSea() ? process.execPath : null,
      });
      return;
    case 'status': {
      const { platform, config } = await configuredPlatform();
      await status(platform, config);
      return;
    }
    case 'version':
      process.stdout.write(`${HOST_VERSION}\n`);
      return;
    case 'help':
      process.stdout.write(USAGE);
      return;
  }
}

main().catch((error: unknown) => {
  // Never on stdout: in host mode stdout carries only framed protocol messages.
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
