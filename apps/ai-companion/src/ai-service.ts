import {
  AiFailure,
  failureCode,
  PLAN_SCOPE,
  type createOpenAiOAuth,
  type createOpenAiProvider,
} from '@email-writer/ai-openai';
import {
  aiAccountLabelSchema,
  type AiCommand,
  type AiInput,
  type AiModel,
  type AiStatus,
  type ErrorCode,
} from '@email-writer/contracts';

import type { CredentialState, CredentialStore } from './credential-store';
import { sameAccountLabel } from './account-label';
import { createSignIn, credentialsFrom } from './sign-in';

export function createAiService(deps: {
  store: CredentialStore;
  oauth: ReturnType<typeof createOpenAiOAuth>;
  provider: ReturnType<typeof createOpenAiProvider>;
  openBrowser: (url: string) => Promise<void>;
}) {
  let models: AiModel[] = [];
  let catalogKey: string | null = null;
  let lastError: ErrorCode | null = null;
  // The account whose catalog this process already tried to load, successfully or not.
  let catalogAttemptKey: string | null = null;
  let automaticCatalogLoad: Promise<void> | null = null;
  let commandBusy = false;
  const running = new Map<string, AbortController>();
  const stopRequests = () => {
    for (const abort of running.values()) abort.abort();
  };
  const credential = async () => {
    const result = await deps.store.update(async (state) => {
      if (state.mode === 'api-key') {
        return state.apiKey
          ? { token: state.apiKey, key: 'api-key', mode: state.mode, model: state.apiModel }
          : null;
      }
      const account = state.accounts.find((item) => item.clientId === state.activeAccountId);
      if (!account?.credentials) return null;
      if (account.credentials.expiresAt < Date.now() + 60_000) {
        if (!account.credentials.refreshToken) {
          account.credentials = null;
          return null;
        }
        try {
          const tokens = await deps.oauth.refresh(account.clientId, account.credentials.refreshToken);
          if (tokens.id_token) {
            const identity = await deps.oauth.verifyIdentity(tokens.id_token, account.clientId, null);
            if (identity.sub !== account.subject) throw new AiFailure('AI_AUTH_FAILED');
          }
          account.credentials = credentialsFrom(tokens, account.credentials);
        } catch (caught) {
          if (caught instanceof AiFailure && caught.code === 'AI_NOT_CONNECTED') {
            account.credentials = null;
            return null;
          }
          throw caught;
        }
      }
      if (!account.credentials.scopes.includes(PLAN_SCOPE)) throw new AiFailure('AI_PLAN_REQUIRED');
      return {
        token: account.credentials.accessToken,
        key: account.clientId,
        mode: state.mode,
        model: account.model,
      };
    });
    if (result === null) throw new AiFailure('AI_NOT_CONNECTED');
    return result;
  };

  const refreshModels = async () => {
    models = [];
    catalogKey = null;
    const auth = await credential();
    catalogAttemptKey = auth.key;
    const available = await deps.provider.listModels(auth.token, auth.mode);
    if (available.length === 0) throw new AiFailure('AI_MODEL_UNAVAILABLE');
    await deps.store.update((state) => {
      // Do not install a catalog fetched for an account that is no longer selected.
      if (state.mode !== auth.mode || (auth.mode === 'chatgpt' && state.activeAccountId !== auth.key)) return;
      models = available;
      catalogKey = auth.key;
      const model = available.some((item) => item.id === auth.model)
        ? auth.model
        : auth.mode === 'chatgpt'
          ? (available[0]?.id ?? null)
          : null;
      if (state.mode === 'api-key') state.apiModel = model;
      else {
        const account = state.accounts.find((item) => item.clientId === auth.key);
        if (account) account.model = model;
      }
    });
  };
  const refreshQuietly = async () => {
    try {
      await refreshModels();
      lastError = null;
    } catch (caught) {
      lastError = failureCode(caught);
    }
  };
  const signIn = createSignIn({ ...deps, onComplete: refreshQuietly });

  const usage = (state: CredentialState) => {
    const active = state.accounts.find((item) => item.clientId === state.activeAccountId);
    return {
      active,
      key: state.mode === 'api-key' ? 'api-key' : state.activeAccountId,
      connected:
        state.mode === 'api-key' ? state.apiKey !== null : !!active?.credentials?.scopes.includes(PLAN_SCOPE),
    };
  };

  const describe = (state: CredentialState): AiStatus => {
    const { active, key, connected } = usage(state);
    const selectedModel = state.mode === 'api-key' ? state.apiModel : (active?.model ?? null);
    return {
      mode: state.mode,
      accounts: state.accounts.map((account) => ({
        id: account.clientId,
        label: account.label,
        email: account.email,
        verified: account.subject !== null,
        connected: account.subject !== null && account.credentials !== null,
        planEnabled: account.credentials?.scopes.includes(PLAN_SCOPE) ?? false,
      })),
      activeAccountId: state.activeAccountId,
      apiKeyConfigured: state.apiKey !== null,
      models: key === catalogKey ? models : [],
      selectedModel,
      ready:
        connected &&
        !signIn.pending() &&
        key === catalogKey &&
        models.some((model) => model.id === selectedModel),
      signingIn: signIn.pending(),
      needsPlanAcknowledgement:
        state.mode === 'chatgpt' && !!active?.credentials?.scopes.includes(PLAN_SCOPE) && !active.welcomed,
      error: signIn.error() ?? lastError,
    };
  };

  const status = async (): Promise<AiStatus> => {
    const state = await deps.store.read();
    const { key, connected } = usage(state);
    // Every native process starts without a catalog. Load it once per account so a
    // connected account is not reported as unavailable after a browser or host restart.
    // A failed load is not repeated on every poll; refresh-models or generation retries.
    if (
      connected &&
      key !== null &&
      key !== catalogKey &&
      key !== catalogAttemptKey &&
      !signIn.pending() &&
      !commandBusy
    ) {
      catalogAttemptKey = key;
      automaticCatalogLoad = refreshQuietly().finally(() => {
        automaticCatalogLoad = null;
      });
    }
    if (automaticCatalogLoad !== null) {
      await automaticCatalogLoad;
      return describe(await deps.store.read());
    }
    return describe(state);
  };

  return {
    status,
    async command(command: AiCommand): Promise<AiStatus> {
      if (command.action === 'cancel-sign-in') {
        signIn.cancel();
        return status();
      }
      if (commandBusy) throw new AiFailure('AI_BUSY');
      if (signIn.pending()) {
        // An explicit new-account action can recover from an OpenAI error page
        // that never returns to our callback. Preserve every saved registration.
        if (
          command.action === 'remove-account' ||
          (command.action === 'connect' && command.accountId === null)
        ) {
          signIn.cancel();
        } else if (command.action !== 'rename-account') throw new AiFailure('AI_BUSY');
      }
      commandBusy = true;
      lastError = null;
      signIn.clearError();
      try {
        if (command.action !== 'acknowledge-plan' && command.action !== 'rename-account') stopRequests();
        switch (command.action) {
          case 'connect':
            await signIn.start(command.accountId);
            break;
          case 'select-account':
            {
              const saved = (await deps.store.read()).accounts.find(
                (account) => account.clientId === command.accountId,
              );
              if (!saved) throw new AiFailure('AI_NOT_CONNECTED');
              if (!saved.credentials || !saved.subject) {
                await signIn.start(saved.clientId);
                break;
              }
            }
            await deps.store.update((state) => {
              if (!state.accounts.some((account) => account.clientId === command.accountId))
                throw new AiFailure('AI_NOT_CONNECTED');
              state.activeAccountId = command.accountId;
              state.mode = 'chatgpt';
            });
            await refreshQuietly();
            break;
          case 'set-mode':
            await deps.store.update((state) => {
              state.mode = command.mode;
            });
            await refreshQuietly();
            break;
          case 'refresh-models':
            await refreshQuietly();
            break;
          case 'set-model': {
            const auth = await credential();
            if (catalogKey !== auth.key) await refreshModels();
            if (!models.some((model) => model.id === command.model))
              throw new AiFailure('AI_MODEL_UNAVAILABLE');
            await deps.store.update((state) => {
              if (state.mode === 'api-key') state.apiModel = command.model;
              else {
                const account = state.accounts.find((item) => item.clientId === state.activeAccountId);
                if (account) account.model = command.model;
              }
            });
            break;
          }
          case 'save-api-key': {
            const available = await deps.provider.listModels(command.apiKey, 'api-key');
            await deps.store.update((state) => {
              state.apiKey = command.apiKey;
              state.mode = 'api-key';
              state.apiModel = null;
            });
            models = available;
            catalogKey = 'api-key';
            break;
          }
          case 'clear-api-key':
            await deps.store.update((state) => {
              state.apiKey = null;
              state.apiModel = null;
            });
            models = [];
            catalogKey = null;
            break;
          case 'rename-account':
            await deps.store.update((state) => {
              const account = state.accounts.find((item) => item.clientId === command.accountId);
              if (!account) throw new AiFailure('AI_NOT_CONNECTED');
              const label = aiAccountLabelSchema.parse(command.label);
              if (
                state.accounts.some(
                  (item) => item.clientId !== account.clientId && sameAccountLabel(item.label, label),
                )
              )
                throw new AiFailure('AI_ACCOUNT_NAME_TAKEN');
              account.label = label;
              account.customLabel = true;
            });
            break;
          case 'disconnect':
          case 'remove-account':
            await deps.store.update(async (state) => {
              const account = state.accounts.find((item) => item.clientId === command.accountId);
              if (!account) throw new AiFailure('AI_NOT_CONNECTED');
              const refresh = account.credentials?.refreshToken;
              if (
                account.credentials &&
                (!refresh || !(await deps.oauth.revoke(account.clientId, refresh).catch(() => false)))
              )
                lastError = 'AI_REVOKE_UNCONFIRMED';
              account.credentials = null;
              if (command.action === 'remove-account') {
                state.accounts = state.accounts.filter((item) => item.clientId !== command.accountId);
                if (state.activeAccountId === command.accountId) state.activeAccountId = null;
              }
            });
            if (catalogKey === command.accountId) {
              models = [];
              catalogKey = null;
            }
            break;
          case 'acknowledge-plan':
            await deps.store.update((state) => {
              const active = state.accounts.find((item) => item.clientId === state.activeAccountId);
              if (active) active.welcomed = true;
            });
            break;
        }
        return await status();
      } finally {
        commandBusy = false;
      }
    },
    async generate(generationId: string, input: AiInput): Promise<{ text: string }> {
      if (commandBusy || signIn.pending() || running.size >= 4 || running.has(generationId))
        throw new AiFailure('AI_BUSY');
      const abort = new AbortController();
      running.set(generationId, abort);
      const timer = setTimeout(() => abort.abort(), 120_000);
      try {
        let auth = await credential();
        if (auth.key !== catalogKey) {
          await refreshModels();
          auth = await credential();
        }
        if (!auth.model || !models.some((model) => model.id === auth.model))
          throw new AiFailure('AI_MODEL_UNAVAILABLE');
        abort.signal.throwIfAborted();
        return { text: await deps.provider.generate(input, auth.model, auth.token, abort.signal) };
      } finally {
        clearTimeout(timer);
        running.delete(generationId);
      }
    },
    cancel(generationId: string) {
      const abort = running.get(generationId);
      abort?.abort();
      return { cancelled: abort !== undefined };
    },
    dispose() {
      signIn.cancel();
      stopRequests();
    },
  };
}
