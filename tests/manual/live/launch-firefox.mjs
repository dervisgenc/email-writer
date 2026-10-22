// Starts Firefox with a persistent profile and BiDi enabled for real Outlook inspection.
// Sign in to Outlook once in this window; the session stays in the profile.
// To run the extension in this window as well: pnpm outlook:dev
// Usage: pnpm outlook:firefox [--restart]
//   --restart  closes the running inspection Firefox and starts it again (e.g. if the
//              window was closed or an unfinished automation session blocks new connections)
import { parseArgs } from 'node:util';

import { LIVE_BIDI_PORT, LIVE_PROFILE } from './live-config.mjs';
import { ensureLiveFirefox } from './live-firefox.mjs';

const { values } = parseArgs({ options: { restart: { type: 'boolean', default: false } } });
const { started, version } = await ensureLiveFirefox({ restart: values.restart });

if (started) {
  console.log(`${version} started (BiDi ${LIVE_BIDI_PORT}).`);
  console.log(`Profile: ${LIVE_PROFILE}`);
  console.log('The Outlook session stays in this profile. Closing the window does not delete it.');
} else {
  console.log(
    `Firefox is already running (BiDi ${LIVE_BIDI_PORT}). To restart it: pnpm outlook:firefox --restart`,
  );
}
