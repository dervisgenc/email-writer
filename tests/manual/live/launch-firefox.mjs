// Starts Firefox with a persistent profile and BiDi enabled for real Outlook or Gmail inspection.
// Sign in once in this profile; the session stays in it.
// To run the extension in this window as well: pnpm outlook:dev (Gmail: pnpm gmail:dev)
// Usage: pnpm outlook:firefox [--restart] [--sign-in]   (Gmail: pnpm gmail:firefox …)
//   --gmail    opens Gmail instead of Outlook
//   --restart  closes the running inspection Firefox and starts it again (e.g. if the
//              window was closed or an unfinished automation session blocks new connections)
//   --sign-in  opens the profile WITHOUT remote control, for signing in: Google refuses to
//              sign in to a browser under automation. Quit that window afterwards.
import { parseArgs } from 'node:util';

import { GMAIL_MAIL_URL, LIVE_BIDI_PORT, LIVE_PROFILE, OUTLOOK_MAIL_URL } from './live-config.mjs';
import { ensureLiveFirefox, openProfileForSignIn } from './live-firefox.mjs';

const { values } = parseArgs({
  options: {
    restart: { type: 'boolean', default: false },
    gmail: { type: 'boolean', default: false },
    'sign-in': { type: 'boolean', default: false },
  },
});
const urls = [values.gmail ? GMAIL_MAIL_URL : OUTLOOK_MAIL_URL];
const command = values.gmail ? 'pnpm gmail:firefox' : 'pnpm outlook:firefox';

if (values['sign-in']) {
  const { version } = await openProfileForSignIn(urls);
  console.log(`${version} opened without remote control, for signing in.`);
  console.log(`Profile: ${LIVE_PROFILE}`);
  console.log(`Sign in, then quit this window (Cmd+Q / Alt+F4) and run: ${command}`);
} else {
  const { started, version } = await ensureLiveFirefox({ restart: values.restart, urls });
  if (started) {
    console.log(`${version} started (BiDi ${LIVE_BIDI_PORT}).`);
    console.log(`Profile: ${LIVE_PROFILE}`);
    console.log('The mail session stays in this profile. Closing the window does not delete it.');
  } else {
    console.log(`Firefox is already running (BiDi ${LIVE_BIDI_PORT}). To restart it: ${command} --restart`);
  }
}
