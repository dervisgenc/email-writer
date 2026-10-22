import type { SiteId } from '@writehand/contracts';

/**
 * Supported Outlook Web addresses, verified against the addresses real test
 * accounts are redirected to (see docs/DEVELOPMENT.md).
 */
export const OUTLOOK_WEB_MATCHES = [
  'https://outlook.live.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.cloud.microsoft/*',
] as const;

/** Gmail on the web, for personal Google accounts and Google Workspace alike. */
export const GMAIL_WEB_MATCHES = ['https://mail.google.com/*'] as const;

export const SITE_MATCHES: Readonly<Record<SiteId, readonly string[]>> = {
  'outlook-web': OUTLOOK_WEB_MATCHES,
  'gmail-web': GMAIL_WEB_MATCHES,
};

/**
 * Local pages each site's content script also runs on in development, test and demo builds
 * (`wxt.config.ts`); the regular package's manifest has none of them. Each site has its own
 * path, so the synthetic Outlook and Gmail pages never get both content scripts.
 */
export const DEVELOPMENT_MATCHES: Readonly<Record<SiteId, readonly string[]>> = {
  'outlook-web': ['http://localhost/mail/*', 'http://127.0.0.1/mail/*'],
  'gmail-web': ['http://localhost/gmail/*', 'http://127.0.0.1/gmail/*'],
};

/** The welcome wizard's "Open Outlook" links: work/school account and personal account. */
export const OUTLOOK_WEB_START = {
  work: 'https://outlook.office.com/mail/',
  personal: 'https://outlook.live.com/mail/',
} as const;

/** The welcome wizard's "Open Gmail" link. */
export const GMAIL_WEB_START = 'https://mail.google.com/mail/';
