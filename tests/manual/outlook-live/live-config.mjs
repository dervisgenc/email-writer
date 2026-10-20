// Shared settings for real Outlook inspection. The profile is kept outside the repository:
// it holds Outlook session cookies and must never be added to the repository.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LIVE_PROFILE =
  process.env.OUTLOOK_LIVE_PROFILE ?? join(homedir(), '.writehand', 'firefox-outlook-profile');

export const LIVE_BIDI_PORT = Number(process.env.OUTLOOK_LIVE_BIDI_PORT ?? 9223);

export const OUTLOOK_MAIL_URL = 'https://outlook.office.com/mail/';
