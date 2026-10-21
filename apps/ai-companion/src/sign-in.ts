import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import {
  AiFailure,
  CODEX_REDIRECT_PORTS,
  codexWorkspaceOf,
  createAuthorization,
  createCodexAuthorization,
  failureCode,
  identityEmail,
  validateCallback,
  type AuthorizationAttempt,
  type createOpenAiOAuth,
  type IdentityClaims,
  type TokenResponse,
} from '@writehand/ai-openai';
import { PRODUCT_NAME, type ChatGptSignIn, type ErrorCode } from '@writehand/contracts';

import type { Account, Credentials, CredentialState, CredentialStore } from './credential-store';
import { defaultAccountLabel } from './account-label';
import { accountIdOf, findAccount, planEnabled, signInOf } from './accounts';

export function credentialsFrom(tokens: TokenResponse, previous?: Credentials): Credentials {
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken,
    idToken: tokens.id_token ?? previous?.idToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? previous?.scopes ?? [],
  };
}

/** Listens on the first free loopback port in `ports`; 0 lets the system choose one. */
async function listen(server: Server, ports: readonly number[]): Promise<number> {
  for (const port of ports) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      const address = server.address();
      if (address && typeof address !== 'string') return address.port;
    } catch (caught) {
      // Another sign-in (for example the Codex CLI's own) may hold a fixed port.
      if ((caught as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw caught;
    }
  }
  throw new AiFailure('AI_AUTH_FAILED');
}

/** The verified identity a callback produced, before it is saved. */
interface VerifiedSignIn {
  readonly clientId: string;
  readonly identity: IdentityClaims & { sub: string };
  /** Codex sign-in only: the ChatGPT account (workspace) the tokens belong to. */
  readonly workspaceId: string | null;
  readonly tokens: TokenResponse;
}

/**
 * The saved account a verified sign-in belongs to. A Sign in with ChatGPT registration is
 * kept from the callback on; a new Codex sign-in is added here, or replaces the tokens of the
 * same user and workspace. A returning account removed meanwhile is never recreated.
 */
function accountFor(
  state: CredentialState,
  verified: VerifiedSignIn,
  returning: Account | undefined,
): Account {
  const { workspaceId } = verified;
  if (workspaceId === null) {
    const saved = state.accounts.find((item) => item.clientId === verified.clientId && !item.codex);
    if (!saved || (saved.subject && saved.subject !== verified.identity.sub))
      throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
    return saved;
  }
  const saved = returning
    ? findAccount(state.accounts, accountIdOf(returning))
    : state.accounts.find(
        (item) => item.codex?.workspaceId === workspaceId && item.subject === verified.identity.sub,
      );
  if (saved) return saved;
  if (returning) throw new AiFailure('AI_NOT_CONNECTED');
  const added: Account = {
    clientId: verified.clientId,
    codex: { id: `codex_${randomUUID()}`, workspaceId },
    subject: null,
    email: null,
    label: defaultAccountLabel(state.accounts),
    credentials: null,
    model: null,
    welcomed: false,
  };
  state.accounts.push(added);
  return added;
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
    /** Signs in a saved account again with its own sign-in, or a new account with `requested`. */
    async start(accountId: string | null, requested: ChatGptSignIn = 'siwc'): Promise<void> {
      if (cancel !== null) throw new AiFailure('AI_BUSY');
      const state = await deps.store.read();
      const account = findAccount(state.accounts, accountId);
      if (accountId !== null && account === undefined) throw new AiFailure('AI_AUTH_FAILED');
      const signIn = account ? signInOf(account) : requested;
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

      /** Keeps a new Sign in with ChatGPT registration even when code exchange fails; the next attempt reuses it. */
      const retainRegistration = (clientId: string, attempt: AuthorizationAttempt) =>
        deps.store.update((current) => {
          if (cancelled) return false;
          if (!current.accounts.some((item) => item.clientId === clientId && !item.codex)) {
            // A different native process may have removed a returning account.
            if (attempt.clientId !== null) throw new AiFailure('AI_NOT_CONNECTED');
            current.accounts.push({
              clientId,
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

      const verify = async (
        attempt: AuthorizationAttempt,
        clientId: string,
        tokens: TokenResponse,
      ): Promise<VerifiedSignIn> => {
        if (!tokens.id_token) throw new AiFailure('AI_AUTH_TOKEN_INVALID');
        const identity = await deps.oauth.verifyIdentity(tokens.id_token, clientId, attempt.nonce);
        const { sub } = identity;
        if (!sub || (account?.subject && sub !== account.subject))
          throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
        const workspaceId = signIn === 'codex' ? codexWorkspaceOf(identity) : null;
        // The authorization request asks for the saved workspace; a different one is not accepted.
        if (account?.codex && workspaceId !== account.codex.workspaceId)
          throw new AiFailure('AI_WORKSPACE_MISMATCH');
        return { clientId, identity: { ...identity, sub }, workspaceId, tokens };
      };

      /** Saves verified credentials and makes the account active; null when cancelled meanwhile. */
      const save = (verified: VerifiedSignIn) =>
        deps.store.update((current) => {
          if (cancelled) return null;
          const saved = accountFor(current, verified, account);
          const email = identityEmail(verified.identity);
          if (!saved.customLabel && (saved.subject === null || /^ChatGPT \d+$/.test(saved.label))) {
            saved.label = defaultAccountLabel(
              current.accounts.filter((item) => item !== saved),
              { name: verified.identity.name, email },
            );
          }
          saved.subject = verified.identity.sub;
          saved.email = email;
          saved.credentials = credentialsFrom(verified.tokens);
          current.activeAccountId = accountIdOf(saved);
          current.mode = 'chatgpt';
          return { planEnabled: planEnabled(saved) };
        });

      try {
        const port = await listen(server, signIn === 'codex' ? CODEX_REDIRECT_PORTS : [0]);
        const redirectUri = `http://127.0.0.1:${port}/auth/callback`;
        const { attempt, url } =
          signIn === 'codex'
            ? createCodexAuthorization(redirectUri, account?.codex?.workspaceId ?? null)
            : createAuthorization(
                state.hostId,
                redirectUri,
                account
                  ? {
                      clientId: account.clientId,
                      email: account.email,
                      idToken: account.credentials?.idToken,
                      planEnabled: planEnabled(account),
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
            request.headers.host !== `127.0.0.1:${port}`
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
              if (signIn === 'siwc' && !(await retainRegistration(result.clientId, attempt))) return;
              if (cancelled) return;
              tokens = await deps.oauth.exchange(attempt, result.clientId, result.code);
              const verified = await verify(attempt, result.clientId, tokens);
              if (cancelled) return;
              const saved = await save(verified);
              credentialsSaved = saved !== null;
              if (cancelled) return;
              // Model discovery must not turn an already verified sign-in into an OAuth failure.
              try {
                await deps.onComplete();
              } catch (caught) {
                if (!cancelled) error = failureCode(caught);
              }
              response.end(
                saved?.planEnabled
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
