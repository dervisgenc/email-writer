import { HELPER_COMMAND } from '@writehand/contracts';

/**
 * The Codex CLI's public OAuth client. Its redirect allow-list accepts only these loopback
 * ports with the `/auth/callback` path (checked against Codex CLI 0.163, October 2026).
 * Kept apart from `oauth.ts`, which needs Node.js, so that `responses.ts` stays browser-safe.
 */
export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CODEX_REDIRECT_PORTS: readonly number[] = [1455, 1457];
/** Names this app, not Codex, on the Codex sign-in page and in every Codex request. */
export const CODEX_ORIGINATOR = HELPER_COMMAND;
