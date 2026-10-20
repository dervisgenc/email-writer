import type { AiMode } from '@writehand/contracts';

/** One section of the connection guide. Text wrapped in `...` is shown as code. */
export interface AiGuideItem {
  readonly title: string;
  readonly summary: string;
  readonly requirements: readonly string[];
  readonly steps: readonly string[];
  readonly notes: readonly string[];
  readonly linkLabel?: string;
}

export interface AiGuideText {
  readonly title: string;
  readonly intro: string;
  readonly requirementsLabel: string;
  readonly stepsLabel: string;
  readonly notesLabel: string;
  readonly current: string;
  readonly methods: Readonly<Record<AiMode, AiGuideItem>>;
  readonly helper: AiGuideItem;
}

export interface AiText {
  readonly title: string;
  readonly description: string;
  readonly chatgpt: string;
  readonly apiKey: string;
  readonly claudeCode: string;
  /** Short description on each method card. */
  readonly methodHints: Readonly<Record<AiMode, string>>;
  readonly methodLabel: string;
  /** Method card badges: recommended (ChatGPT) and experimental (Claude). */
  readonly recommended: string;
  readonly experimental: string;
  readonly statusReady: string;
  readonly statusSetup: string;
  readonly statusAction: string;
  readonly connect: string;
  readonly addAccount: string;
  readonly reconnect: string;
  readonly disconnect: string;
  readonly account: string;
  readonly activeAccount: string;
  readonly useAccount: string;
  readonly savedConnection: string;
  readonly renameAccount: string;
  readonly accountName: string;
  readonly accountNameHint: string;
  readonly saveAccountName: string;
  readonly removeAccount: string;
  readonly removeAccountTitle: string;
  readonly removeAccountBody: string;
  readonly confirmRemoveAccount: string;
  readonly savedAccountHint: string;
  readonly model: string;
  readonly refresh: string;
  readonly checking: string;
  readonly signingIn: string;
  readonly cancel: string;
  readonly connected: string;
  readonly disconnected: string;
  readonly registrationIncomplete: string;
  readonly generationUnavailable: string;
  readonly planDisabled: string;
  readonly planNote: string;
  readonly apiNote: string;
  readonly claudeNote: string;
  readonly claudeAccount: string;
  readonly claudeNotInstalled: string;
  readonly claudeNotLoggedIn: string;
  readonly claudeApiBilling: string;
  readonly claudePrivacy: string;
  readonly apiKeyLabel: string;
  readonly saveKey: string;
  readonly removeKey: string;
  readonly keySaved: string;
  readonly manageUsage: string;
  readonly connectionHelp: string;
  readonly welcome: string;
  readonly welcomeBody: string;
  readonly gotIt: string;
  readonly privacy: string;
  readonly usePlan: string;
  readonly useApi: string;
  readonly useClaude: string;
  readonly openSettings: string;
  readonly notReady: string;
  readonly guide: AiGuideText;
}
