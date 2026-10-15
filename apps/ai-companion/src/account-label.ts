import type { Account } from './credential-store';

export function sameAccountLabel(first: string, second: string): boolean {
  return first.normalize('NFKC').toLowerCase() === second.normalize('NFKC').toLowerCase();
}

/** Names describe a verified identity; workspace names are never guessed from email domains. */
export function defaultAccountLabel(
  accounts: readonly Account[],
  identity: { name?: unknown; email?: unknown } = {},
): string {
  const name = [identity.name, identity.email].find(
    (value): value is string => typeof value === 'string' && !!value.trim(),
  );
  const base = name?.replace(/\s+/g, ' ').trim().slice(0, 64) || 'ChatGPT';
  let label = base;
  let suffix = 2;
  while (accounts.some((account) => sameAccountLabel(account.label, label))) {
    label = `${base} (${suffix++})`;
  }
  return label;
}
