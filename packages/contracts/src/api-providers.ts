/**
 * Providers the extension reaches directly with the user's own API key, without the helper
 * app. Each provider's API origin is an optional host permission that the extension asks for
 * when the user connects a key, so a fresh install has no access to any of them.
 */
export const API_PROVIDERS = ['groq', 'openrouter', 'openai'] as const;
export type ApiProvider = (typeof API_PROVIDERS)[number];

/** Groq offers free models (OpenAI's open-weight GPT-OSS among them) without a payment method. */
export const DEFAULT_API_PROVIDER: ApiProvider = 'groq';

export interface ApiProviderDetails {
  /** Brand name; never translated. */
  readonly name: string;
  /** Host permission pattern that covers every request to the provider's API. */
  readonly permission: string;
  /** Where users create an API key. */
  readonly keysUrl: string;
  /** How the provider's keys begin, shown as the input placeholder. */
  readonly keyPrefix: string;
}

export const OPENAI_API_KEYS_URL = 'https://platform.openai.com/api-keys';

export const API_PROVIDER_DETAILS: Readonly<Record<ApiProvider, ApiProviderDetails>> = {
  groq: {
    name: 'Groq',
    permission: 'https://api.groq.com/*',
    keysUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_',
  },
  openrouter: {
    name: 'OpenRouter',
    permission: 'https://openrouter.ai/*',
    keysUrl: 'https://openrouter.ai/settings/keys',
    keyPrefix: 'sk-or-',
  },
  openai: {
    name: 'OpenAI',
    permission: 'https://api.openai.com/*',
    keysUrl: OPENAI_API_KEYS_URL,
    keyPrefix: 'sk-',
  },
};

/** The manifest's `optional_host_permissions`; nothing else is ever requested. */
export const API_PROVIDER_PERMISSIONS: readonly string[] = API_PROVIDERS.map(
  (provider) => API_PROVIDER_DETAILS[provider].permission,
);

/**
 * The provider whose key format `apiKey` has, by the longest matching prefix (`sk-or-` before
 * `sk-`); null when none matches. Used to stop a key from being sent to the wrong provider.
 */
export function apiProviderOfKey(apiKey: string): ApiProvider | null {
  const prefix = (provider: ApiProvider) => API_PROVIDER_DETAILS[provider].keyPrefix;
  const matches = API_PROVIDERS.filter((provider) => apiKey.startsWith(prefix(provider)));
  return matches.sort((left, right) => prefix(right).length - prefix(left).length)[0] ?? null;
}
