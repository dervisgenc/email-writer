// Development tool that inspects the real Gmail page with the extension's reading code.
// Connects over WebDriver BiDi to the Firefox opened by `pnpm outlook:firefox`; open Gmail in
// a tab of that window and sign in once (the session stays in the profile).
//
// Rules: it only reads. It never clicks, types, sends, replies to, deletes or moves email.
// Output is masked; real content is never written to the terminal or to disk
// (see docs/DEVELOPMENT.md).
//
// Usage:
//   pnpm gmail:inspect read                 reads the open conversation with the connector
//   pnpm gmail:inspect selectors [key]      match count of each selector (all / rendered)
//   pnpm gmail:inspect composers            the drafts the connector finds and how it splits them
//   pnpm gmail:inspect theme                Gmail's theme as the extension reads it
//   pnpm gmail:inspect structure [target]   anonymous DOM structure (default: threadView)
//     --bodies  also show inside message bodies   --depth N   --lines N
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { explainLiveError, requireLiveFirefox, withMailProbe } from './live-probe.mjs';

function printThreadReport(report) {
  console.log(`Page: ${report.support} · conversation key: ${report.threadKey ?? '—'}`);
  console.log(`Selectors: ${report.selectors.map((entry) => `${entry.key}=${entry.matches}`).join(' ')}`);
  const { thread } = report;
  if (thread === null) {
    console.log('No open conversation found.');
    return;
  }
  if ('error' in thread) {
    console.log(`Read error: ${thread.error}`);
    return;
  }
  console.log(`Subject: ${thread.subject ?? '(not found)'}`);
  console.log(
    `Messages: ${thread.messages.length} · active: ${thread.activeMessage === null ? 'undetermined' : `#${thread.activeMessage}`}`,
  );
  for (const message of thread.messages) {
    console.log(`  #${message.order}  sender: ${message.sender ?? '—'} · date: ${message.sentAtText ?? '—'}`);
    for (const block of message.blocks) {
      console.log(`      ${block.kind} (${block.certainty}, ${block.length} chars): ${block.shape}`);
    }
  }
  const { coverage, text } = thread;
  console.log(
    `Coverage: ${coverage.status} · readable ${coverage.readableMessageCount} · unreadable ${coverage.knownUnreadableMessageCount ?? 'unknown'} · ${coverage.reasons.join(', ')}`,
  );
  const ratio = text.rendered === 0 ? '—' : `${Math.round((text.extracted / text.rendered) * 100)}%`;
  console.log(
    `Text (non-whitespace characters): read ${text.extracted} / on screen ${text.rendered} (${ratio})`,
  );
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    bodies: { type: 'boolean', default: false },
    depth: { type: 'string', default: '40' },
    lines: { type: 'string', default: '400' },
  },
});
const [command = 'read', argument] = positionals;

await requireLiveFirefox();

async function runCommand(probe) {
  switch (command) {
    case 'read':
      printThreadReport(await probe.call('readThread'));
      break;
    case 'selectors':
      for (const entry of await probe.call('selectorMatches', argument)) {
        console.log(`${entry.key} (${entry.status})`);
        for (const { selector, matches, rendered } of entry.selectors) {
          console.log(
            `  ${String(matches).padStart(4)} / ${String(rendered).padStart(4)} rendered  ${selector}`,
          );
        }
      }
      break;
    case 'composers':
      console.log(JSON.stringify(await probe.call('composers'), null, 2));
      break;
    case 'theme':
      console.log(JSON.stringify(await probe.call('theme'), null, 2));
      break;
    case 'structure': {
      const result = await probe.call(
        'structure',
        argument ?? 'threadView',
        Number(values.depth),
        Number(values.lines),
        values.bodies,
      );
      console.log(result.found ? result.lines.join('\n') : `Target not found: ${argument ?? 'threadView'}`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  await withMailProbe(
    {
      tab: /^https:\/\/mail\.google\.com\/mail\//,
      // A tab with a conversation open (a token at the end of the URL hash) comes first.
      prefer: /#[^?]*\/[A-Za-z0-9_-]{16,}/,
      missing:
        'Gmail tab not found. Open https://mail.google.com/mail/ in the window of "pnpm outlook:firefox".',
      probe: resolve(import.meta.dirname, 'gmail-probe/probe.ts'),
    },
    (_bidi, _context, probe) => runCommand(probe),
  );
} catch (error) {
  console.error(explainLiveError(error));
  process.exitCode = 1;
}
