import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { PRODUCT_NAME } from '@writehand/contracts';

import { AiFailure, providerFailure } from './errors';

export const OPENAI_ISSUER = 'https://auth.openai.com';
export const OPENAI_RESOURCE = 'https://api.openai.com/v1';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const scopes = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1).optional(),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().positive().max(604_800),
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

export interface AuthorizationAttempt {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly redirectUri: string;
  readonly clientId: string | null;
}

export function createAuthorization(
  hostId: string,
  redirectUri: string,
  account?: { clientId: string; idToken?: string; email: string | null; planEnabled: boolean },
) {
  const attempt: AuthorizationAttempt = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(48).toString('base64url'),
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
    nonce: attempt.nonce,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(attempt.verifier).digest('base64url'),
    ...(!account ? { agent_name_hint: PRODUCT_NAME } : {}),
    ...(account?.idToken ? { id_token_hint: account.idToken } : {}),
    ...(account?.email ? { login_hint: account.email } : {}),
    ...(account && !account.planEnabled ? { prompt: 'consent' } : {}),
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
    (attempt.clientId !== null && issued !== null && issued !== attempt.clientId)
  )
    throw new AiFailure('AI_AUTH_FAILED');
  const code = params.get('code');
  if (!code || code.length > 4096) throw new AiFailure('AI_AUTH_FAILED');
  return { clientId, code };
}

export function createOpenAiOAuth(
  fetcher: typeof fetch = fetch,
  jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${OPENAI_ISSUER}/.well-known/jwks.json`)),
) {
  const tokenRequest = async (fields: Record<string, string>, refreshing = false): Promise<TokenResponse> => {
    const response = await fetcher(`${OPENAI_ISSUER}/api/accounts/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...fields, resource: OPENAI_RESOURCE }),
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
      tokenRequest({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        code_verifier: attempt.verifier,
        redirect_uri: attempt.redirectUri,
      }),
    refresh: (clientId: string, refreshToken: string) =>
      tokenRequest({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken }, true),
    async verifyIdentity(idToken: string, clientId: string, nonce: string | null): Promise<JWTPayload> {
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
