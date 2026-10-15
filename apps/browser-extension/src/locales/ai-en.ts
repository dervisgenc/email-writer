import type { AiText } from '@email-writer/ui';

export const aiEn: AiText = {
  title: 'AI connection',
  description: 'Write emails using your ChatGPT plan or your own OpenAI API key.',
  chatgpt: 'ChatGPT plan',
  apiKey: 'OpenAI API key',
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
  apiKeyLabel: 'API key',
  saveKey: 'Connect key',
  removeKey: 'Remove key',
  keySaved: 'API key saved in the local connection.',
  manageUsage: 'Manage usage',
  connectionHelp:
    'Manage this connection in ChatGPT Settings → Security and login → Sign in with ChatGPT. It does not appear in Plugins. Work accounts are also subject to organization policy and plan eligibility.',
  welcome: 'You’re using your ChatGPT plan',
  welcomeBody:
    'Eligible generation in Email Writer uses your ChatGPT plan allowance or available credits. Manage this app’s usage in ChatGPT settings.',
  gotIt: 'Got it',
  privacy:
    'When you request generation, your text, instructions and selected context are sent to OpenAI. The extension does not save them to disk. It cannot access your ChatGPT conversation history.',
  setup: 'Set up the local connection',
  setupBody:
    'The ChatGPT connection requires the Email Writer local app (macOS / Linux, Node.js 22+). Follow docs/AI_BAGLANTISI.md in the project. Account credentials are kept in a protected file on your device instead of browser storage.',
  extensionId: 'Extension ID for installation:',
  usePlan: 'Using ChatGPT plan',
  useApi: 'Using OpenAI API',
  openSettings: 'AI settings',
  notReady: 'Connect an AI account to generate text',
};
