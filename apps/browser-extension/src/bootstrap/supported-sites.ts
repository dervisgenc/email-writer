/**
 * Supported Outlook Web addresses, verified against the addresses real test
 * accounts are redirected to (see docs/DEVELOPMENT.md). Development and test
 * builds add local page addresses in `wxt.config.ts`; they are not in the
 * regular package's manifest.
 */
export const OUTLOOK_WEB_MATCHES = [
  'https://outlook.live.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.cloud.microsoft/*',
] as const;

export const DEVELOPMENT_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'] as const;

/** The welcome wizard's "Open Outlook" links: work/school account and personal account. */
export const OUTLOOK_WEB_START = {
  work: 'https://outlook.office.com/mail/',
  personal: 'https://outlook.live.com/mail/',
} as const;
