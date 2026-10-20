// Starts an installed helper app the way a browser does and sends it one framed request
// (HOST_INFO by default), then prints the response. Used by CI after the install scripts
// run, and for checking an installation by hand:
//   node scripts/smoke-helper.mjs <program> [--expect-version=X.Y.Z] [--request=AI_STATUS]
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const [program, ...options] = process.argv.slice(2);
if (!program) {
  console.error('Usage: node scripts/smoke-helper.mjs <program> [--expect-version=X.Y.Z] [--request=TYPE]');
  process.exit(2);
}
const option = (name) => options.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const type = option('request') ?? 'HOST_INFO';
const requestId = randomUUID();

// Chrome passes the calling extension's origin; the helper must not treat it as a command.
const child = spawn(program, ['chrome-extension://abcdefghijklmnopabcdefghijklmnop/'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  // Windows only runs .cmd launchers (development installs) through a shell, as browsers do.
  shell: /\.(cmd|bat)$/i.test(program),
});
const body = Buffer.from(JSON.stringify({ protocolVersion: 1, requestId, type, payload: {} }));
const header = Buffer.alloc(4);
header.writeUInt32LE(body.length);
child.stdin.write(Buffer.concat([header, body]));

const timer = setTimeout(() => {
  console.error('No response within 20 seconds.');
  child.kill();
  process.exit(1);
}, 20_000);
let buffer = Buffer.alloc(0);
child.stdout.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length < 4 || buffer.length < 4 + buffer.readUInt32LE(0)) return;
  clearTimeout(timer);
  const response = JSON.parse(buffer.subarray(4, 4 + buffer.readUInt32LE(0)).toString('utf8'));
  child.stdin.end();
  console.log(JSON.stringify(response, null, 2));
  const expected = option('expect-version');
  const ok =
    response.requestId === requestId &&
    response.ok === true &&
    (expected === undefined || response.payload?.version === expected);
  process.exitCode = ok ? 0 : 1;
});
child.on('exit', (code) => {
  if (buffer.length === 0) {
    clearTimeout(timer);
    console.error(`The helper exited (${code}) without answering.`);
    process.exit(1);
  }
});
