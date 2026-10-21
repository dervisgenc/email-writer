import {
  DEFAULT_CLAUDE_CODE_MODEL,
  type ClaudeCodeProvider,
  type ClaudeCodeStatus,
} from '@writehand/ai-claude-code';
import {
  AiFailure,
  failureCode,
  PLAN_SCOPE,
  type createOpenAiOAuth,
  type createOpenAiProvider,
} from '@writehand/ai-openai';
import {
  aiAccountLabelSchema,
  type AiInput,
  type AiModel,
  type ErrorCode,
  type HelperCommand,
  type HelperStatus,
} from '@writehand/contracts';

import type { CredentialState, CredentialStore } from './credential-store';
import { sameAccountLabel } from './account-label';
import { createSignIn, credentialsFrom } from './sign-in';

export function createAiService(deps: {
  store: CredentialStore;
  oauth: ReturnType<typeof createOpenAiOAuth>;
  provider: ReturnType<typeof createOpenAiProvider>;
  claude: Pick<ClaudeCodeProvider, 'models' | 'status' | 'generate'>;
  openBrowser: (url: string) => Promise<void>;
}) {
  let models: AiModel[] = [];
  let catalogKey: string | null = null;
  let lastError: ErrorCode | null = null;
  // The account whose catalog this process already tried to load, successfully or not.
  let catalogAttemptKey: string | null = null;
  let automaticCatalogLoad: Promise<void> | null = null;
  let commandBusy = false;
  // Claude Code's sign-in state is read through its own CLI. The connection indicator
  // polls every few seconds, so the answer is reused for a short while.
  let claudeCache: { at: number; value: Promise<ClaudeCodeStatus> } | null = null;
  const claudeStatus = (force = false): Promise<ClaudeCodeStatus> => {
    if (force || claudeCache === null || Date.now() - claudeCache.at > 30_000) {
      const value = deps.claude.status().catch((caught: unknown) => {
        claudeCache = null;
        throw caught;
      });
      claudeCache = { at: Date.now(), value };
    }
    return claudeCache.value;
  };
  const running = new Map<string, AbortController>();
  const stopRequests = () => {
    for (const abort of running.values()) abort.abort();
  };
  /** The active ChatGPT account's credentials; the Claude Code method never passes through here. */
  const credential = async () => {
    const result = await deps.store.update(async (state) => {
      if (state.mode === 'claude-code') return null;
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
      return { token: account.credentials.accessToken, key: account.clientId, model: account.model };
    });
    if (result === null) throw new AiFailure('AI_NOT_CONNECTED');
    return result;
  };

  const refreshModels = async () => {
    models = [];
    catalogKey = null;
    const auth = await credential();
    catalogAttemptKey = auth.key;
    const available = await deps.provider.listModels(auth.token, 'chatgpt');
    if (available.length === 0) throw new AiFailure('AI_MODEL_UNAVAILABLE');
    await deps.store.update((state) => {
      // Do not install a catalog fetched for an account that is no longer selected.
      if (state.mode !== 'chatgpt' || state.activeAccountId !== auth.key) return;
      models = available;
      catalogKey = auth.key;
      const account = state.accounts.find((item) => item.clientId === auth.key);
      if (account)
        account.model = available.some((item) => item.id === auth.model)
          ? auth.model
          : (available[0]?.id ?? null);
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
      key: state.mode === 'chatgpt' ? state.activeAccountId : state.mode,
      connected: state.mode === 'chatgpt' && !!active?.credentials?.scopes.includes(PLAN_SCOPE),
    };
  };

  /** Saved choice, or the default when that model is no longer offered (e.g. Haiku). */
  const claudeModelOf = (state: CredentialState): string =>
    deps.claude.models.some((model) => model.id === state.claudeModel)
      ? (state.claudeModel as string)
      : DEFAULT_CLAUDE_CODE_MODEL;

  const describe = (state: CredentialState, claude: ClaudeCodeStatus | null): HelperStatus => {
    const { active, key, connected } = usage(state);
    const claudeMode = state.mode === 'claude-code';
    const selectedModel = claudeMode ? claudeModelOf(state) : (active?.model ?? null);
    // Claude Code resolves model aliases itself; there is no account catalog to load.
    const available = claudeMode ? [...deps.claude.models] : key === catalogKey ? models : [];
    const usable = claudeMode
      ? claude?.installed === true && claude.loggedIn
      : connected && key === catalogKey;
    // An installation that cannot be started safely is explained through the error field.
    let claudeCode: HelperStatus['claudeCode'] = null;
    let claudeProblem: ErrorCode | null = null;
    if (claudeMode && claude) {
      const { problem, ...view } = claude;
      claudeCode = view;
      claudeProblem = problem ?? null;
    }
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
      models: available,
      selectedModel,
      ready: usable && !signIn.pending() && available.some((model) => model.id === selectedModel),
      signingIn: signIn.pending(),
      needsPlanAcknowledgement:
        state.mode === 'chatgpt' && !!active?.credentials?.scopes.includes(PLAN_SCOPE) && !active.welcomed,
      claudeCode,
      error: signIn.error() ?? lastError ?? claudeProblem,
    };
  };

  const status = async (): Promise<HelperStatus> => {
    const state = await deps.store.read();
    if (state.mode === 'claude-code') return describe(state, await claudeStatus());
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
      return describe(await deps.store.read(), null);
    }
    return describe(state, null);
  };

  const generateWithClaude = async (model: string, input: AiInput, signal: AbortSignal) => {
    let claude = await claudeStatus();
    // The user may have just installed Claude Code or signed in; check again before failing.
    if (!claude.installed || !claude.loggedIn) claude = await claudeStatus(true);
    if (!claude.installed) throw new AiFailure(claude.problem ?? 'AI_CLAUDE_NOT_INSTALLED');
    if (!claude.loggedIn) throw new AiFailure('AI_CLAUDE_NOT_LOGGED_IN');
    const result = await deps.claude.generate(input, model, signal);
    if (result.ok) return result.value;
    if (
      result.error.code === 'AI_CLAUDE_NOT_LOGGED_IN' ||
      result.error.code === 'AI_CLAUDE_NOT_INSTALLED' ||
      result.error.code === 'AI_CLAUDE_UNSUPPORTED_INSTALL'
    )
      claudeCache = null;
    throw new AiFailure(result.error.code);
  };

  return {
    status,
    async command(command: HelperCommand): Promise<HelperStatus> {
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
            if (command.mode === 'claude-code') await claudeStatus(true);
            else await refreshQuietly();
            break;
          case 'refresh-models':
            if ((await deps.store.read()).mode === 'claude-code') await claudeStatus(true);
            else await refreshQuietly();
            break;
          case 'set-model': {
            if ((await deps.store.read()).mode === 'claude-code') {
              if (!deps.claude.models.some((model) => model.id === command.model))
                throw new AiFailure('AI_MODEL_UNAVAILABLE');
              await deps.store.update((state) => {
                state.claudeModel = command.model;
              });
              break;
            }
            const auth = await credential();
            if (catalogKey !== auth.key) await refreshModels();
            if (!models.some((model) => model.id === command.model))
              throw new AiFailure('AI_MODEL_UNAVAILABLE');
            await deps.store.update((state) => {
              const account = state.accounts.find((item) => item.clientId === state.activeAccountId);
              if (account) account.model = command.model;
            });
            break;
          }
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
        const state = await deps.store.read();
        if (state.mode === 'claude-code') {
          const model = claudeModelOf(state);
          return { text: await generateWithClaude(model, input, abort.signal) };
        }
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
