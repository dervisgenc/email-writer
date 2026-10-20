import { createServer } from 'node:http';
import {
  AiFailure,
  createAuthorization,
  failureCode,
  PLAN_SCOPE,
  validateCallback,
  type createOpenAiOAuth,
  type TokenResponse,
} from '@writehand/ai-openai';
import { PRODUCT_NAME, type ErrorCode } from '@writehand/contracts';

import type { Credentials, CredentialStore } from './credential-store';
import { defaultAccountLabel } from './account-label';

export function credentialsFrom(tokens: TokenResponse, previous?: Credentials): Credentials {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken,
    idToken: tokens.id_token ?? previous?.idToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? previous?.scopes ?? [],
  };
}

export function createSignIn(deps: {
  store: CredentialStore;
  oauth: ReturnType<typeof createOpenAiOAuth>;
  openBrowser: (url: string) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  let cancel: (() => void) | null = null;
  let error: ErrorCode | null = null;
  return {
    pending: () => cancel !== null,
    error: () => error,
    clearError() {
      error = null;
    },
    cancel() {
      cancel?.();
    },
    async start(accountId: string | null): Promise<void> {
      if (cancel !== null) throw new AiFailure('AI_BUSY');
      const state = await deps.store.read();
      const account = state.accounts.find((item) => item.clientId === accountId);
      if (accountId !== null && account === undefined) throw new AiFailure('AI_AUTH_FAILED');
      error = null;
      let cancelled = false;
      let consumed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const server = createServer();
      const stop = () => {
        clearTimeout(timer);
        server.close();
        server.closeAllConnections();
        if (cancel === cancelAttempt) cancel = null;
      };
      const cancelAttempt = () => {
        cancelled = true;
        error = 'AI_AUTH_CANCELLED';
        stop();
      };
      cancel = cancelAttempt;
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', () => resolve());
        });
        const address = server.address();
        if (!address || typeof address === 'string') throw new AiFailure('AI_AUTH_FAILED');
        const redirectUri = `http://127.0.0.1:${address.port}/auth/callback`;
        const { attempt, url } = createAuthorization(
          state.hostId,
          redirectUri,
          account
            ? {
                clientId: account.clientId,
                email: account.email,
                idToken: account.credentials?.idToken,
                planEnabled: account.credentials?.scopes.includes(PLAN_SCOPE) ?? false,
              }
            : undefined,
        );
        server.on('request', (request, response) => {
          const callback = new URL(request.url ?? '/', redirectUri);
          response.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Referrer-Policy', 'no-referrer');
          response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
          if (
            request.method !== 'GET' ||
            callback.pathname !== '/auth/callback' ||
            request.headers.host !== `127.0.0.1:${address.port}`
          ) {
            response.writeHead(404).end('Not found.');
            return;
          }
          // Unrelated requests must not consume the pending authorization attempt.
          if (callback.searchParams.get('state') !== attempt.state || consumed || cancelled) {
            response.writeHead(400).end('Invalid or expired sign-in.');
            return;
          }
          consumed = true;
          void (async () => {
            let tokens: TokenResponse | undefined;
            let credentialsSaved = false;
            let issuedClientId: string | undefined;
            try {
              const result = validateCallback(callback, attempt);
              issuedClientId = result.clientId;
              // Keep the registration even when code exchange fails; the next attempt reuses it.
              const retained = await deps.store.update((current) => {
                if (cancelled) return false;
                if (!current.accounts.some((item) => item.clientId === result.clientId)) {
                  // A different native process may have removed a returning account.
                  if (attempt.clientId !== null) throw new AiFailure('AI_NOT_CONNECTED');
                  current.accounts.push({
                    clientId: result.clientId,
                    subject: null,
                    email: null,
                    label: defaultAccountLabel(current.accounts),
                    credentials: null,
                    model: null,
                    welcomed: false,
                  });
                }
                return true;
              });
              if (!retained || cancelled) return;
              tokens = await deps.oauth.exchange(attempt, result.clientId, result.code);
              if (!tokens.id_token) throw new AiFailure('AI_AUTH_TOKEN_INVALID');
              const identity = await deps.oauth.verifyIdentity(
                tokens.id_token,
                result.clientId,
                attempt.nonce,
              );
              if (!identity.sub || (account?.subject && identity.sub !== account.subject))
                throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
              if (cancelled) return;
              const verifiedTokens = tokens;
              credentialsSaved = await deps.store.update((current) => {
                if (cancelled) return false;
                const saved = current.accounts.find((item) => item.clientId === result.clientId);
                if (!saved || (saved.subject && saved.subject !== identity.sub))
                  throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
                if (!saved.customLabel && (saved.subject === null || /^ChatGPT \d+$/.test(saved.label))) {
                  saved.label = defaultAccountLabel(
                    current.accounts.filter((item) => item.clientId !== saved.clientId),
                    { name: identity.name, email: identity.email },
                  );
                }
                saved.subject = identity.sub ?? null;
                saved.email = typeof identity.email === 'string' ? identity.email : null;
                saved.credentials = credentialsFrom(verifiedTokens);
                current.activeAccountId = result.clientId;
                current.mode = 'chatgpt';
                return true;
              });
              if (cancelled) return;
              // Model discovery must not turn an already verified sign-in into an OAuth failure.
              try {
                await deps.onComplete();
              } catch (caught) {
                if (!cancelled) error = failureCode(caught);
              }
              response.end(
                tokens.scope?.split(/\s+/).includes(PLAN_SCOPE)
                  ? `Sign-in completed. Return to ${PRODUCT_NAME} to check text generation availability.`
                  : `Sign-in completed. ChatGPT plan usage is not enabled for this connection. Return to ${PRODUCT_NAME} for account and plan details.`,
              );
            } catch (caught) {
              if (!cancelled) error = failureCode(caught);
              response
                .writeHead(400)
                .end(
                  `Sign-in could not be completed (${failureCode(caught)}). Return to ${PRODUCT_NAME} for details.`,
                );
            } finally {
              if (!credentialsSaved && tokens?.refresh_token && issuedClientId) {
                await deps.oauth.revoke(issuedClientId, tokens.refresh_token).catch(() => false);
              }
              stop();
            }
          })();
        });
        timer = setTimeout(() => {
          cancelled = true;
          error = 'AI_AUTH_FAILED';
          stop();
        }, 5 * 60_000);
        await deps.openBrowser(url);
      } catch (caught) {
        stop();
        throw caught;
      }
    },
  };
}
