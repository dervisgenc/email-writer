// Development tool that inspects the real Outlook page with the extension's reading code.
// Connects over WebDriver BiDi to the Firefox opened by `pnpm outlook:firefox`.
//
// Rules: it only reads and clicks conversation rows. It never sends, replies to,
// deletes or moves email, and sends no keyboard events. Output is masked; real
// content is never written to the terminal or to disk (see docs/DEVELOPMENT.md).
//
// Usage:
//   pnpm outlook:inspect rows                 conversation rows
//   pnpm outlook:inspect open <index>         clicks the row and reads the opened conversation
//   pnpm outlook:inspect read                 reads the open conversation with the connector
//   pnpm outlook:inspect selectors [key]      match count of each selector separately
//   pnpm outlook:inspect theme                Outlook theme colors
//   pnpm outlook:inspect layout               position of the extension buttons and overlap with Outlook buttons
//   pnpm outlook:inspect diagnose-reply       records the connector state during "Reply" (opens an empty draft)
//   pnpm outlook:inspect structure [target]   anonymous DOM structure (default: readingPane)
//     --bodies  also show inside message bodies   --depth N   --lines N   --rows <css>
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  clickAt,
  explainLiveError,
  requireLiveFirefox,
  sleep,
  waitUntil,
  withMailProbe,
} from './live-probe.mjs';

const OPEN_TIMEOUT_MS = 5_000;
const OPEN_SETTLE_MS = 500;

function printRows(rows) {
  if (rows.length === 0) {
    console.log('No conversation rows found (pass a selector with --rows).');
    return;
  }
  for (const row of rows) {
    console.log(
      `${row.selected ? '▶' : ' '} ${String(row.index).padStart(3)}  ${row.conversationId ?? '(no convid)'}  ${row.shape}`,
    );
  }
}

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
    console.log(
      `  #${message.order}  sender: ${message.sender ?? '—'} · date: ${message.sentAt ?? '—'} / ${message.sentAtText ?? '—'}`,
    );
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
    rows: { type: 'string' },
  },
});
const [command = 'read', argument] = positionals;

await requireLiveFirefox();

async function runCommand(bidi, context, probe) {
  switch (command) {
    case 'rows':
      printRows(await probe.call('rows', values.rows));
      break;
    case 'open': {
      const index = Number(argument);
      const point = Number.isInteger(index) ? await probe.call('rowClickPoint', index, values.rows) : null;
      if (point === null) {
        throw new Error(`Row ${argument} not found or it has no safe click point.`);
      }
      await probe.call('markReadingPane');
      await clickAt(bidi, context, point);
      if (!(await waitUntil(() => probe.call('targetRowSelected'), OPEN_TIMEOUT_MS))) {
        throw new Error('The click did not select the target conversation; nothing was read.');
      }
      if (!(await waitUntil(() => probe.call('readingPaneChanged'), OPEN_TIMEOUT_MS))) {
        console.log('Note: the reading pane did not change (the same message may already be open).');
      }
      // A short wait for parts of the body that load late (e.g. image placeholders).
      await sleep(OPEN_SETTLE_MS);
      printThreadReport(await probe.call('readThread'));
      break;
    }
    case 'read':
      printThreadReport(await probe.call('readThread'));
      break;
    case 'structure': {
      const result = await probe.call(
        'structure',
        argument ?? 'readingPane',
        Number(values.depth),
        Number(values.lines),
        values.bodies,
      );
      console.log(result.found ? result.lines.join('\n') : `Target not found: ${argument ?? 'readingPane'}`);
      break;
    }
    case 'theme':
      console.log(JSON.stringify(await probe.call('theme'), null, 2));
      break;
    case 'layout':
      console.log(JSON.stringify(await probe.call('launcherLayout'), null, 2));
      break;
    case 'diagnose-reply': {
      // Starts the connector while a message is shown, presses "Reply" and records the transition.
      // It never touches Send and types nothing; close the empty draft it opens by hand.
      const start = await probe.call('watchStart');
      if (start.bodies === 0) {
        await probe.call('watchStop');
        throw new Error('Open a message first (there is no message body in the reading pane).');
      }
      console.log(`start ${JSON.stringify(start)}`);
      const point = await probe.call('replyClickPoint');
      if (point === null) {
        await probe.call('watchStop');
        throw new Error('"Reply" button not found or it has no safe click point.');
      }
      await clickAt(bidi, context, point);
      for (let elapsed = 250; elapsed <= 4000; elapsed += 250) {
        await sleep(250);
        console.log(`${String(elapsed).padStart(4)} ms ${JSON.stringify(await probe.call('watchState'))}`);
      }
      await probe.call('watchStop');
      break;
    }
    case 'selectors':
      for (const entry of await probe.call('selectorMatches', argument)) {
        console.log(`${entry.key} (${entry.status})`);
        for (const { selector, matches } of entry.selectors) {
          console.log(`  ${String(matches).padStart(4)}  ${selector}`);
        }
      }
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  await withMailProbe(
    {
      tab: /^https:\/\/outlook\.[^/]+\/mail\//,
      missing: 'Outlook mail tab not found. If the window was closed: pnpm outlook:firefox --restart',
      probe: resolve(import.meta.dirname, 'outlook-probe/probe.ts'),
    },
    (bidi, context, probe) => runCommand(bidi, context, probe),
  );
} catch (error) {
  console.error(explainLiveError(error));
  process.exitCode = 1;
}
