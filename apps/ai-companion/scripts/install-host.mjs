import { access, chmod, constants, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = 'com.email_writer.ai';
const args = process.argv.slice(2).filter((value) => value !== '--');
const browser = args.find((value) => !value.startsWith('--'));
const id = args.find((value) => value.startsWith('--extension-id='))?.slice('--extension-id='.length);
const uninstall = args.includes('--uninstall');
const mac = process.platform === 'darwin';
if (!mac && process.platform !== 'linux')
  throw new Error('This installer currently supports macOS and Linux.');
const directories = mac
  ? {
      firefox: 'Library/Application Support/Mozilla/NativeMessagingHosts',
      chrome: 'Library/Application Support/Google/Chrome/NativeMessagingHosts',
      edge: 'Library/Application Support/Microsoft Edge/NativeMessagingHosts',
      brave: 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts',
    }
  : {
      firefox: '.mozilla/native-messaging-hosts',
      chrome: '.config/google-chrome/NativeMessagingHosts',
      edge: '.config/microsoft-edge/NativeMessagingHosts',
      brave: '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts',
    };
async function findExecutable(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    // pnpm puts the workspace's node_modules/.bin first; those are not user installations.
    if (!isAbsolute(directory) || directory.includes(`${sep}node_modules${sep}`)) continue;
    try {
      await access(join(directory, name), constants.X_OK);
      return join(directory, name);
    } catch {
      /* Not in this directory. */
    }
  }
  return null;
}
if (!Object.hasOwn(directories, browser ?? ''))
  throw new Error('Usage: pnpm ai:install firefox|chrome|edge|brave [--extension-id=ID] [--uninstall]');
const directory = join(homedir(), directories[browser]);
const manifestPath = join(directory, `${name}.json`);
if (uninstall) {
  await rm(manifestPath, { force: true });
  console.log(
    'Native host registration removed. Sign out in the extension before uninstalling to revoke tokens. Local credentials remain in ~/.config/email-writer.',
  );
} else {
  const extensionId = id ?? (browser === 'firefox' ? 'email-writer@example.invalid' : '');
  if (browser === 'firefox' ? !/^[\w@.{}+-]{1,256}$/.test(extensionId) : !/^[a-p]{32}$/.test(extensionId))
    throw new Error('Supply the installed extension ID with --extension-id=ID.');
  const installDirectory = join(homedir(), '.local', 'share', 'email-writer');
  const host = join(installDirectory, 'host.mjs');
  const launcher = join(installDirectory, 'email-writer-ai');
  const source = fileURLToPath(new URL('../dist/host.mjs', import.meta.url));
  await readFile(source); // Fail before changing registration if the build is missing.
  await mkdir(installDirectory, { recursive: true, mode: 0o700 });
  await copyFile(source, host);
  await chmod(host, 0o600);
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  // The browser starts the host with a minimal environment. Record what this shell uses
  // so the optional Claude Code method runs the same installation and account.
  const claude = await findExecutable('claude');
  const claudeConfig = process.env.CLAUDE_CONFIG_DIR;
  const exports = [
    // An npm-installed Claude Code runs on Node.js.
    `PATH=${quote(dirname(process.execPath))}:"$PATH"; export PATH`,
    // Claude Code finds its macOS Keychain sign-in by user name.
    'USER="${USER:-$(id -un)}"; export USER',
    ...(claude ? [`EMAIL_WRITER_CLAUDE_PATH=${quote(claude)}; export EMAIL_WRITER_CLAUDE_PATH`] : []),
    ...(claudeConfig ? [`CLAUDE_CONFIG_DIR=${quote(claudeConfig)}; export CLAUDE_CONFIG_DIR`] : []),
  ];
  await writeFile(
    launcher,
    `#!/bin/sh\n${exports.join('\n')}\nexec ${quote(process.execPath)} ${quote(host)} "$@"\n`,
    { mode: 0o700 },
  );
  await chmod(launcher, 0o700);
  await mkdir(directory, { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        name,
        description: 'Email Writer local AI connection',
        path: launcher,
        type: 'stdio',
        ...(browser === 'firefox'
          ? { allowed_extensions: [extensionId] }
          : { allowed_origins: [`chrome-extension://${extensionId}/`] }),
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
  console.log(
    `Installed for ${browser}: ${manifestPath}\n` +
      `Claude Code: ${claude ?? 'not found (install it and run this command again to use it)'}` +
      (claudeConfig ? ` · configuration: ${claudeConfig}` : '') +
      '\nRestart the extension, then open Settings → AI connection.',
  );
}
