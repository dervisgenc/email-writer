import { PRODUCT_NAME } from '@email-writer/contracts';
import type { AiText } from '@email-writer/ui';

export const aiEn: AiText = {
  title: 'AI connection',
  description:
    'Write emails using your ChatGPT plan, your own OpenAI API key or Claude Code on this computer.',
  chatgpt: 'ChatGPT plan',
  apiKey: 'OpenAI API key',
  claudeCode: 'Claude plan',
  methodHints: {
    chatgpt: 'With your Plus or Pro plan',
    'api-key': 'Pay as you go',
    'claude-code': 'With Claude Code on this computer',
  },
  methodLabel: 'Connection method',
  statusReady: 'Ready',
  statusSetup: 'Setup needed',
  statusAction: 'Connection needed',
  guide: {
    title: 'Connection guide',
    intro:
      'Set up one of the methods below to generate text. Each section lists what you need and the steps to follow.',
    requirementsLabel: 'You need',
    stepsLabel: 'Steps',
    notesLabel: 'Good to know',
    current: 'Selected',
    methods: {
      chatgpt: {
        title: 'ChatGPT plan',
        summary: 'Generates with the usage included in your ChatGPT Plus or Pro plan.',
        requirements: [
          'A ChatGPT Plus or Pro subscription. Free accounts do not support plan usage.',
          `The ${PRODUCT_NAME} helper app on this computer.`,
        ],
        steps: [
          'Choose ChatGPT plan as the method.',
          'Select “Continue with ChatGPT”. In the page that opens, choose your account and allow access.',
          'Come back to this page; the account shows “Connected · Ready to generate text”. Then choose a model.',
        ],
        notes: [
          'Usage counts against your ChatGPT plan limits. You can follow it in ChatGPT → Settings → Usage.',
          'If you just upgraded your plan, it may take a few minutes to become active.',
          'OpenAI currently supports only Plus and Pro plans. On work accounts (Business, Enterprise), an organization policy may block the connection.',
          'You can remove access at any time in ChatGPT → Settings → Security and login → Sign in with ChatGPT.',
        ],
      },
      'api-key': {
        title: 'OpenAI API key',
        summary: 'Generates with your own OpenAI Platform account; you pay for what you use.',
        requirements: [
          'An OpenAI Platform account and an API key.',
          `The ${PRODUCT_NAME} helper app on this computer.`,
        ],
        steps: [
          'Create an API key on OpenAI Platform.',
          'Choose OpenAI API key as the method, paste the key and select “Connect key”.',
          'Choose a model from the list.',
        ],
        notes: [
          'API usage is separate from a ChatGPT subscription and is billed by OpenAI.',
          'The key is stored only in the helper app on this computer and is never sent back to the browser.',
        ],
        linkLabel: 'Create an API key',
      },
      'claude-code': {
        title: 'Claude plan',
        summary: 'Uses Claude Code on your computer with your own Claude account.',
        requirements: [
          'A Claude Pro, Max, Team or Enterprise subscription.',
          'Claude Code installed on this computer and signed in with your Claude account.',
          `The ${PRODUCT_NAME} helper app. Installed after Claude Code, it finds Claude Code automatically.`,
        ],
        steps: [
          'Install Claude Code by following Anthropic’s official instructions.',
          'In a terminal, run `claude` and sign in to your Claude account with `/login`.',
          'Install the helper app; if you installed it earlier, install it again after Claude Code.',
          'Choose Claude plan as the method. Your account and plan appear here.',
        ],
        notes: [
          `${PRODUCT_NAME} never sees or stores your Claude password or session; you sign in and out through Claude Code.`,
          'Usage counts against your plan limit, which is shared with Claude Code.',
          'On Pro and Max plans, content may be used for model training unless you turned it off in your Claude privacy settings. Team and Enterprise plans are governed by commercial terms.',
          'If Claude Code is signed in with an API key, usage is billed to that API account.',
          'This method depends on Anthropic’s rules for third-party apps and is offered as experimental. It may stop working if those rules change.',
        ],
        linkLabel: 'Claude Code setup guide',
      },
    },
    helper: {
      title: 'What is the helper app?',
      summary: 'A small app on your computer that every method needs.',
      requirements: ['macOS, Linux or Windows.', 'Node.js 22 or later.'],
      steps: [
        'Install the helper app and restart the browser.',
        'The “The local AI connection is unavailable” warning on this page goes away and the methods appear.',
      ],
      notes: [
        'Sign-in details and API keys are kept in a protected file only you can access, not in the browser.',
        'The helper app runs only when you ask for text; it never reads or sends email in the background.',
      ],
    },
  },
  connect: 'Continue with ChatGPT',
  addAccount: 'Add a different account or workspace',
  reconnect: 'Reconnect',
  disconnect: 'Disconnect',
  account: 'ChatGPT account',
  activeAccount: 'Account in use',
  useAccount: 'Use this account',
  savedConnection: 'Account connected. Select Use this account to generate with it.',
  renameAccount: 'Rename',
  accountName: 'Connection name',
  accountNameHint:
    'For example Personal or Work · Company name. The name is local to this device; up to 80 characters.',
  saveAccountName: 'Save name',
  removeAccount: 'Remove account',
  removeAccountTitle: 'Remove this connection?',
  removeAccountBody:
    'The account record and credentials will be removed from this device; revoking the OpenAI session will be attempted if present. Pending sign-in will be cancelled. Add the account again to use it later. Your ChatGPT account will not be deleted.',
  confirmRemoveAccount: 'Remove',
  savedAccountHint:
    'Select a saved connection to rename or remove it. Sign-in buttons use the selected connection’s account and workspace. To connect another account, use the add button below.',
  model: 'Model',
  refresh: 'Refresh',
  checking: 'Checking connection…',
  signingIn: 'Complete ChatGPT sign-in in the browser window.',
  cancel: 'Cancel',
  connected: 'Connected · Ready to generate text',
  disconnected: 'Signed out',
  registrationIncomplete:
    'Account connection is incomplete; its account details have not been verified yet. Try Continue with ChatGPT again using the same account and workspace as the first attempt.',
  generationUnavailable:
    'Account verified and plan permission granted; text generation is not ready yet. Select Refresh to reload the model list.',
  planDisabled:
    'Account verified; generation is not authorized. Plan usage requires an eligible Plus/Pro account and permission to use its plan. Signing in with a free account does not grant generation access.',
  planNote:
    'Eligible Plus and Pro accounts can use their plan allowance. Availability depends on your account, workspace and OpenAI access.',
  apiNote:
    'API usage is billed separately by OpenAI. It is independent of your ChatGPT subscription; this method is never selected automatically.',
  claudeNote: `Claude Code installed on this computer runs with your own Claude account; usage counts against your Claude plan limits. ${PRODUCT_NAME} does not access or store your Claude credentials. Sign in and out through Claude Code.`,
  claudeAccount: 'Claude Code account',
  claudeNotInstalled:
    'Claude Code was not found on this computer. Install Claude Code, run pnpm ai:install again, then select Refresh.',
  claudeNotLoggedIn:
    'Claude Code is not signed in. Run claude in a terminal and sign in with /login, then select Refresh.',
  claudeApiBilling:
    'Claude Code is signed in with a method other than a Claude subscription, such as an API key; usage is billed to that account.',
  claudePrivacy:
    'When you request generation, your text, instructions and selected context are sent to Anthropic through Claude Code. Claude Code runs without tools, cannot access your files and keeps no session transcript. Pro and Max plans are governed by Anthropic’s consumer terms: unless you turned off model training in your Claude privacy settings, content may be used for training. Team and Enterprise plans are governed by commercial terms.',
  apiKeyLabel: 'API key',
  saveKey: 'Connect key',
  removeKey: 'Remove key',
  keySaved: 'API key saved in the local connection.',
  manageUsage: 'Manage usage',
  connectionHelp:
    'Manage this connection in ChatGPT Settings → Security and login → Sign in with ChatGPT. It does not appear in Plugins. Work accounts are also subject to organization policy and plan eligibility.',
  welcome: 'You’re using your ChatGPT plan',
  welcomeBody: `Eligible generation in ${PRODUCT_NAME} uses your ChatGPT plan allowance or available credits. Manage this app’s usage in ChatGPT settings.`,
  gotIt: 'Got it',
  privacy:
    'When you request generation, your text, instructions and selected context are sent to OpenAI. The extension does not save them to disk. It cannot access your ChatGPT conversation history.',
  setup: 'Set up the local connection',
  setupBody: `The AI connection requires the ${PRODUCT_NAME} local app (macOS, Linux or Windows; Node.js 22+). Follow docs/AI_BAGLANTISI.md in the project. Account credentials are kept in a protected file on your device instead of browser storage. The Claude plan method also requires Claude Code to be installed and signed in.`,
  extensionId: 'Extension ID for installation:',
  usePlan: 'Using ChatGPT plan',
  useApi: 'Using OpenAI API',
  useClaude: 'Using Claude plan',
  openSettings: 'AI settings',
  notReady: 'Connect an AI account to generate text',
};
