import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { HELPER_COMMAND, PRODUCT_NAME, type ChatGptSignIn } from '@writehand/contracts';

import { AiFailure, providerFailure } from './errors';

export const OPENAI_ISSUER = 'https://auth.openai.com';
export const OPENAI_RESOURCE = 'https://api.openai.com/v1';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const scopes = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
/**
 * The Codex CLI's public OAuth client. Its redirect allow-list accepts only these loopback
 * ports with the `/auth/callback` path (checked against Codex CLI 0.163, October 2026).
 */
export const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const CODEX_REDIRECT_PORTS: readonly number[] = [1455, 1457];
const codexScopes = 'openid profile email offline_access';
/** Names this app, not Codex, on the Codex sign-in page and in every Codex request. */
export const CODEX_ORIGINATOR = HELPER_COMMAND;
/** Each sign-in exchanges and refreshes its tokens at its own endpoint. */
const tokenEndpoints: Readonly<Record<ChatGptSignIn, { path: string; resource?: string }>> = {
  siwc: { path: '/api/accounts/oauth/token', resource: OPENAI_RESOURCE },
  codex: { path: '/oauth/token' },
};
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  // The Codex client does not rely on the type; any type other than bearer is still refused.
  token_type: z
    .string()
    .refine((value) => value.toLowerCase() === 'bearer')
    .optional(),
  // Codex sign-in access tokens last longer than a week.
  expires_in: z.number().positive().max(2_592_000),
  scope: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenSchema>;
const terminalRefreshErrors = new Set([
  'invalid_grant',
  'invalid_refresh_token',
  'token_expired',
  'refresh_token_expired',
  'refresh_token_invalidated',
  'refresh_token_reused',
]);
const codexClaimsSchema = z.object({
  'https://api.openai.com/auth': z.object({ chatgpt_account_id: z.string().min(1).max(256) }),
});
const profileClaimsSchema = z.object({
  'https://api.openai.com/profile': z.object({ email: z.string() }),
});

/** Claims of a verified ID token. */
export type IdentityClaims = JWTPayload;

export interface AuthorizationAttempt {
  readonly signIn: ChatGptSignIn;
  readonly state: string;
  /** Sent only by Sign in with ChatGPT; the Codex sign-in sends none, like the Codex CLI. */
  readonly nonce: string | null;
  readonly verifier: string;
  readonly redirectUri: string;
  /** The client the callback must belong to; null while registering a new Sign in with ChatGPT client. */
  readonly clientId: string | null;
}

/** The sign-in a client's tokens belong to, which decides where they are refreshed. */
export function signInForClient(clientId: string): ChatGptSignIn {
  return clientId === CODEX_CLIENT_ID ? 'codex' : 'siwc';
}

const randomToken = (bytes: number) => randomBytes(bytes).toString('base64url');
const codeChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export function createAuthorization(
  hostId: string,
  redirectUri: string,
  account?: { clientId: string; idToken?: string; email: string | null; planEnabled: boolean },
) {
  const nonce = randomToken(32);
  const attempt: AuthorizationAttempt = {
    signIn: 'siwc',
    state: randomToken(32),
    nonce,
    verifier: randomToken(48),
    redirectUri,
    clientId: account?.clientId ?? null,
  };
  const url = new URL(`${OPENAI_ISSUER}/api/accounts/authorize`);
  url.search = new URLSearchParams({
    client_id: account?.clientId ?? 'dynamic_agent_client',
    ext_agent_host_id: hostId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    resource: OPENAI_RESOURCE,
    state: attempt.state,
    nonce,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge(attempt.verifier),
    ...(!account ? { agent_name_hint: PRODUCT_NAME } : {}),
    ...(account?.idToken ? { id_token_hint: account.idToken } : {}),
    ...(account?.email ? { login_hint: account.email } : {}),
    ...(account && !account.planEnabled ? { prompt: 'consent' } : {}),
  }).toString();
  return { attempt, url: url.toString() };
}

/** The Codex CLI's authorization request; `workspaceId` keeps a saved account in its workspace. */
export function createCodexAuthorization(redirectUri: string, workspaceId: string | null = null) {
  const attempt: AuthorizationAttempt = {
    signIn: 'codex',
    state: randomToken(32),
    nonce: null,
    verifier: randomToken(48),
    redirectUri,
    clientId: CODEX_CLIENT_ID,
  };
  const url = new URL(`${OPENAI_ISSUER}/oauth/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CODEX_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: codexScopes,
    code_challenge: codeChallenge(attempt.verifier),
    code_challenge_method: 'S256',
    state: attempt.state,
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    originator: CODEX_ORIGINATOR,
    ...(workspaceId ? { allowed_workspace_id: workspaceId } : {}),
  }).toString();
  return { attempt, url: url.toString() };
}

export function validateCallback(
  url: URL,
  attempt: AuthorizationAttempt,
): { clientId: string; code: string } {
  const params = url.searchParams;
  for (const key of ['state', 'code', 'client_id', 'error', 'iss']) {
    if (params.getAll(key).length > 1) throw new AiFailure('AI_AUTH_FAILED');
  }
  if (params.get('state') !== attempt.state || (params.has('iss') && params.get('iss') !== OPENAI_ISSUER))
    throw new AiFailure('AI_AUTH_FAILED');
  if (params.has('error')) {
    const code = params.get('error');
    if (code === '3p_delegated_access_policy_denied') throw new AiFailure('AI_POLICY_DENIED');
    if (code === '3p_login_workspace_scope_denied') throw new AiFailure('AI_WORKSPACE_MISMATCH');
    if (code === 'subscription_sharing_user_not_eligible') throw new AiFailure('AI_NOT_ELIGIBLE');
    throw new AiFailure(code === 'access_denied' ? 'AI_AUTH_CANCELLED' : 'AI_AUTH_FAILED');
  }
  const issued = params.get('client_id');
  const clientId = issued ?? attempt.clientId;
  if (
    !clientId ||
    clientId === 'dynamic_agent_client' ||
    clientId.length > 256 ||
    signInForClient(clientId) !== attempt.signIn ||
    (attempt.clientId !== null && issued !== null && issued !== attempt.clientId)
  )
    throw new AiFailure('AI_AUTH_FAILED');
  const code = params.get('code');
  if (!code || code.length > 4096) throw new AiFailure('AI_AUTH_FAILED');
  return { clientId, code };
}

/** The ChatGPT account (a personal account or a workspace) that a verified Codex sign-in belongs to. */
export function codexWorkspaceOf(identity: IdentityClaims): string {
  const parsed = codexClaimsSchema.safeParse(identity);
  if (!parsed.success) throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
  return parsed.data['https://api.openai.com/auth'].chatgpt_account_id;
}

/** The verified email, which Codex sign-in tokens may carry only in OpenAI's profile claim. */
export function identityEmail(identity: IdentityClaims): string | null {
  if (typeof identity.email === 'string') return identity.email;
  const profile = profileClaimsSchema.safeParse(identity);
  return profile.success ? profile.data['https://api.openai.com/profile'].email : null;
}

export function createOpenAiOAuth(
  fetcher: typeof fetch = fetch,
  jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${OPENAI_ISSUER}/.well-known/jwks.json`)),
) {
  const tokenRequest = async (
    signIn: ChatGptSignIn,
    fields: Record<string, string>,
    refreshing = false,
  ): Promise<TokenResponse> => {
    const endpoint = tokenEndpoints[signIn];
    const response = await fetcher(`${OPENAI_ISSUER}${endpoint.path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...fields,
        ...(endpoint.resource ? { resource: endpoint.resource } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const raw: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z
        .object({ error: z.union([z.string(), z.object({ code: z.string() })]).optional() })
        .safeParse(raw);
      const code = parsed.success
        ? typeof parsed.data.error === 'string'
          ? parsed.data.error
          : parsed.data.error?.code
        : undefined;
      if (refreshing && code && terminalRefreshErrors.has(code)) throw new AiFailure('AI_NOT_CONNECTED');
      if (
        response.status === 400 &&
        !refreshing &&
        code !== '3p_delegated_access_policy_denied' &&
        code !== '3p_login_workspace_scope_denied'
      )
        throw new AiFailure('AI_AUTH_EXCHANGE_FAILED');
      throw providerFailure(response.status, code);
    }
    const parsed = tokenSchema.safeParse(raw);
    if (!parsed.success) throw new AiFailure('AI_AUTH_TOKEN_INVALID');
    return parsed.data;
  };
  return {
    exchange: (attempt: AuthorizationAttempt, clientId: string, code: string) =>
      tokenRequest(attempt.signIn, {
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        code_verifier: attempt.verifier,
        redirect_uri: attempt.redirectUri,
      }),
    refresh: (clientId: string, refreshToken: string) =>
      tokenRequest(
        signInForClient(clientId),
        { grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken },
        true,
      ),
    async verifyIdentity(idToken: string, clientId: string, nonce: string | null): Promise<IdentityClaims> {
      try {
        const { payload } = await jwtVerify(idToken, jwks, {
          issuer: OPENAI_ISSUER,
          audience: clientId,
          algorithms: ['RS256'],
          requiredClaims: ['sub', 'exp', 'iat', ...(nonce === null ? [] : ['nonce'])],
        });
        if (
          (nonce !== null && payload.nonce !== nonce) ||
          !payload.sub ||
          (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)
        )
          throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
        return payload;
      } catch {
        throw new AiFailure('AI_AUTH_IDENTITY_FAILED');
      }
    },
    async revoke(clientId: string, refreshToken: string): Promise<boolean> {
      try {
        const discovery = await fetcher(`${OPENAI_ISSUER}/.well-known/openid-configuration`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!discovery.ok) return false;
        const config = z
          .object({ issuer: z.literal(OPENAI_ISSUER), revocation_endpoint: z.string().url() })
          .parse(await discovery.json());
        const url = new URL(config.revocation_endpoint);
        if (url.origin !== OPENAI_ISSUER) return false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await fetcher(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                token: refreshToken,
                token_type_hint: 'refresh_token',
              }),
              signal: AbortSignal.timeout(10_000),
            });
            if (response.status === 200) return true;
            if (response.status < 500) return false;
          } catch {
            /* Retry once without logging credentials or response bodies. */
          }
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch {
        /* Local sign-out still clears tokens if revocation cannot be confirmed. */
      }
      return false;
    },
  };
}
