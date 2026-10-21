import { PLAN_SCOPE } from '@writehand/ai-openai';
import type { ChatGptSignIn } from '@writehand/contracts';

import type { Account } from './credential-store';

/** The ID the extension uses for a saved account. */
export function accountIdOf(account: Account): string {
  return account.codex?.id ?? account.clientId;
}

export function findAccount(accounts: readonly Account[], id: string | null): Account | undefined {
  return accounts.find((account) => accountIdOf(account) === id);
}

export function signInOf(account: Account): ChatGptSignIn {
  return account.codex ? 'codex' : 'siwc';
}

/** Sign in with ChatGPT grants plan usage only with its plan scope; a Codex sign-in always does. */
export function planEnabled(account: Account): boolean {
  if (!account.credentials) return false;
  return account.codex !== undefined || account.credentials.scopes.includes(PLAN_SCOPE);
}
