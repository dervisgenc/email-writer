// Gerçek Outlook incelemesinin ortak ayarları. Profil depo dışında tutulur:
// içinde Outlook oturum çerezleri bulunur ve asla depoya eklenmemelidir.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LIVE_PROFILE =
  process.env.OUTLOOK_LIVE_PROFILE ?? join(homedir(), '.email-writer', 'firefox-outlook-profile');

export const LIVE_BIDI_PORT = Number(process.env.OUTLOOK_LIVE_BIDI_PORT ?? 9223);

export const OUTLOOK_MAIL_URL = 'https://outlook.office.com/mail/';
