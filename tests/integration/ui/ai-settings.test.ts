import { AiConnectionGuide, AiConnectionSettings } from '@email-writer/ui';
import type { AiStatus } from '@email-writer/contracts';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { tr } from '../../../apps/browser-extension/src/locales/tr';

const disconnected: AiStatus = {
  mode: 'chatgpt',
  accounts: [],
  activeAccountId: null,
  apiKeyConfigured: false,
  models: [],
  selectedModel: null,
  ready: false,
  signingIn: false,
  needsPlanAcknowledgement: false,
  claudeCode: null,
  error: null,
};
const render = (status: AiStatus | null) =>
  mount(AiConnectionSettings, {
    props: { status, text: tr.ui.ai, busy: false, error: null, extensionId: 'test-extension' },
  });

describe('AI connection settings', () => {
  it('lets users select and rename an incomplete account without signing in or changing the active account', async () => {
    const wrapper = render({
      ...disconnected,
      activeAccountId: 'oaiapp_active',
      ready: true,
      accounts: [
        {
          id: 'oaiapp_active',
          label: 'Kişisel',
          email: null,
          verified: true,
          connected: true,
          planEnabled: true,
        },
        {
          id: 'oaiapp_incomplete',
          label: 'ChatGPT',
          email: null,
          verified: false,
          connected: false,
          planEnabled: false,
        },
      ],
      models: [{ id: 'allowed', label: 'Allowed' }],
      selectedModel: 'allowed',
    });
    await wrapper.get('.ew-select').setValue('oaiapp_incomplete');
    expect(wrapper.emitted('command')).toBeUndefined();
    expect(wrapper.text()).toContain('Kullanımdaki hesap: Kişisel');
    expect(wrapper.text()).toContain(tr.ui.ai.registrationIncomplete);
    expect(wrapper.findAll('select')).toHaveLength(1);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === tr.ui.ai.renameAccount)!
      .trigger('click');
    const input = wrapper.get('input[type=text]');
    // Polling pending sign-in must not discard an in-progress name edit.
    await input.setValue('İş');
    await wrapper.setProps({
      status: {
        ...wrapper.props('status')!,
        signingIn: true,
        accounts: wrapper.props('status')!.accounts.map((account) => ({ ...account })),
      },
    });
    expect((wrapper.get('input[type=text]').element as HTMLInputElement).value).toBe('İş');
    await input.setValue('   ');
    expect(wrapper.get('button[type=submit]').attributes('disabled')).toBeDefined();
    await input.setValue('  İş · Acme  ');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('command')).toEqual([
      [{ action: 'rename-account', accountId: 'oaiapp_incomplete', label: 'İş · Acme' }],
    ]);
    wrapper.unmount();
  });

  it('requires an explicit action to activate another connected account', async () => {
    const wrapper = render({
      ...disconnected,
      activeAccountId: 'oaiapp_active',
      accounts: ['active', 'other'].map((id) => ({
        id: `oaiapp_${id}`,
        label: id,
        email: null,
        verified: true,
        connected: true,
        planEnabled: true,
      })),
    });
    await wrapper.get('.ew-select').setValue('oaiapp_other');
    expect(wrapper.emitted('command')).toBeUndefined();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === tr.ui.ai.useAccount)!
      .trigger('click');
    expect(wrapper.emitted('command')).toEqual([[{ action: 'select-account', accountId: 'oaiapp_other' }]]);
    wrapper.unmount();
  });

  it('allows removing incomplete records during pending login, with confirmation and cancellation', async () => {
    const wrapper = render({
      ...disconnected,
      signingIn: true,
      accounts: [
        {
          id: 'oaiapp_incomplete',
          label: 'İş hesabı',
          email: null,
          verified: false,
          connected: false,
          planEnabled: false,
        },
      ],
    });
    const remove = wrapper.findAll('button').find((button) => button.text() === tr.ui.ai.removeAccount)!;
    expect(remove.attributes('disabled')).toBeUndefined();
    await remove.trigger('click');
    const dialog = wrapper.get('.ew-ai-account-dialog');
    expect(dialog.text()).toContain('İş hesabı');
    expect(wrapper.emitted('command')).toBeUndefined();
    await dialog
      .findAll('button')
      .find((button) => button.text() === tr.ui.ai.cancel)!
      .trigger('click');
    expect(wrapper.emitted('command')).toBeUndefined();
    await remove.trigger('click');
    await dialog
      .findAll('button')
      .find((button) => button.text() === tr.ui.ai.confirmRemoveAccount)!
      .trigger('click');
    expect(wrapper.emitted('command')).toEqual([
      [{ action: 'remove-account', accountId: 'oaiapp_incomplete' }],
    ]);
    wrapper.unmount();
  });
  it('reuses an incomplete saved registration when the first code exchange failed', async () => {
    const wrapper = render({
      ...disconnected,
      accounts: [
        {
          id: 'oaiapp_saved',
          label: 'ChatGPT 1',
          email: null,
          verified: false,
          connected: false,
          planEnabled: false,
        },
      ],
    });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Continue with ChatGPT')!
      .trigger('click');
    expect(wrapper.emitted('command')?.[0]).toEqual([{ action: 'connect', accountId: 'oaiapp_saved' }]);
    expect(wrapper.text()).toContain(tr.ui.ai.registrationIncomplete);
    expect(wrapper.text()).not.toContain(tr.ui.ai.connected);
    wrapper.unmount();
  });
  it('starts a separate connection for another workspace even when a saved login is pending', async () => {
    const wrapper = render({
      ...disconnected,
      signingIn: true,
      accounts: [
        {
          id: 'oaiapp_personal',
          label: 'ChatGPT 1',
          email: null,
          verified: false,
          connected: false,
          planEnabled: false,
        },
      ],
    });
    expect(wrapper.text()).toContain(tr.ui.ai.savedAccountHint);
    const newAccount = wrapper.findAll('button').find((button) => button.text() === tr.ui.ai.addAccount)!;
    expect(newAccount.attributes('disabled')).toBeUndefined();
    await newAccount.trigger('click');
    expect(wrapper.emitted('command')?.[0]).toEqual([{ action: 'connect', accountId: null }]);
    wrapper.unmount();
  });
  it.each([
    [false, tr.ui.ai.planDisabled],
    [true, tr.ui.ai.generationUnavailable],
  ])('does not present sign-in as generation readiness (plan permission: %s)', (planEnabled, message) => {
    const wrapper = render({
      ...disconnected,
      activeAccountId: 'oaiapp_saved',
      accounts: [
        {
          id: 'oaiapp_saved',
          label: 'ChatGPT 1',
          email: 'test@example.test',
          verified: true,
          connected: true,
          planEnabled,
        },
      ],
    });
    expect(wrapper.text()).toContain(message);
    expect(wrapper.text()).not.toContain(tr.ui.ai.connected);
    expect(wrapper.find('select[id*="model"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('offers recognizable ChatGPT sign-in and explicitly separates API billing', async () => {
    const wrapper = render(disconnected);
    const button = wrapper.findAll('button').find((button) => button.text() === 'Continue with ChatGPT')!;
    await button.trigger('click');
    expect(wrapper.emitted('command')?.[0]).toEqual([{ action: 'connect', accountId: null }]);
    expect(wrapper.text()).toContain('Plus ve Pro');
    expect(wrapper.find('a').attributes('href')).toBe('https://chatgpt.com/settings/usage');
    wrapper.unmount();
  });
  it('clears API key input immediately after sending it to the connection', async () => {
    const wrapper = render({ ...disconnected, mode: 'api-key' });
    expect(wrapper.text()).toContain('ayrıca ücretlendirilir');
    await wrapper.get('input[type=password]').setValue('sk-private-test-key');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('command')?.[0]).toEqual([
      { action: 'save-api-key', apiKey: 'sk-private-test-key' },
    ]);
    expect((wrapper.get('input[type=password]').element as HTMLInputElement).value).toBe('');
    wrapper.unmount();
  });
  it('shows installation guidance when the native host is missing', () => {
    const wrapper = render(null);
    expect(wrapper.get('details').attributes('open')).toBeDefined();
    expect(wrapper.text()).toContain('test-extension');
    expect(wrapper.text()).toContain('docs/AI_BAGLANTISI.md');
    expect(wrapper.find('input[type=password]').exists()).toBe(false);
    wrapper.unmount();
  });
  describe('Claude plan method', () => {
    const claude = {
      ...disconnected,
      mode: 'claude-code' as const,
      models: [
        { id: 'sonnet', label: 'Claude Sonnet' },
        { id: 'haiku', label: 'Claude Haiku' },
      ],
      selectedModel: 'sonnet',
    };
    const signedIn = {
      installed: true,
      loggedIn: true,
      subscription: true,
      plan: 'team',
      account: 'c@example.test',
      organization: 'Acme',
    };

    it('offers the method and switches to it', async () => {
      const wrapper = render(disconnected);
      const method = wrapper.get('input[type=radio][value="claude-code"]');
      expect(method.element.closest('label')?.textContent).toContain(tr.ui.ai.claudeCode);
      expect(method.element.closest('label')?.textContent).toContain(tr.ui.ai.methodHints['claude-code']);
      await method.setValue(true);
      expect(wrapper.emitted('command')?.[0]).toEqual([{ action: 'set-mode', mode: 'claude-code' }]);
      wrapper.unmount();
    });

    it('shows the signed-in Claude Code account, the model choice and the Anthropic privacy note', async () => {
      const wrapper = render({ ...claude, ready: true, claudeCode: signedIn });
      expect(wrapper.text()).toContain(tr.ui.ai.connected);
      expect(wrapper.text()).toContain(`${tr.ui.ai.claudeAccount}: c@example.test · Acme · Team`);
      expect(wrapper.text()).toContain(tr.ui.ai.claudePrivacy);
      expect(wrapper.text()).not.toContain(tr.ui.ai.privacy);
      expect(wrapper.find('input[type=password]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Continue with ChatGPT');
      await wrapper.get('select').setValue('haiku');
      expect(wrapper.emitted('command')?.[0]).toEqual([{ action: 'set-model', model: 'haiku' }]);
      wrapper.unmount();
    });

    it('explains how to install or sign in, and warns when Claude Code is not on a subscription', () => {
      const missing = render({
        ...claude,
        claudeCode: {
          ...signedIn,
          installed: false,
          loggedIn: false,
          account: null,
          organization: null,
          plan: null,
        },
      });
      expect(missing.text()).toContain(tr.ui.ai.claudeNotInstalled);
      missing.unmount();
      const signedOut = render({
        ...claude,
        claudeCode: { ...signedIn, loggedIn: false, account: null, organization: null, plan: null },
      });
      expect(signedOut.text()).toContain(tr.ui.ai.claudeNotLoggedIn);
      expect(signedOut.text()).not.toContain(tr.ui.ai.claudeAccount);
      signedOut.unmount();
      const apiBilled = render({ ...claude, ready: true, claudeCode: { ...signedIn, subscription: false } });
      expect(apiBilled.text()).toContain(tr.ui.ai.claudeApiBilling);
      apiBilled.unmount();
    });
  });
  it('shows a status badge: ready, setup needed or connection needed', () => {
    const ready = render({ ...disconnected, mode: 'api-key', apiKeyConfigured: true, ready: true });
    expect(ready.get('.ew-status-pill').text()).toBe(tr.ui.ai.statusReady);
    expect(ready.get('.ew-status-pill').attributes('data-tone')).toBe('success');
    ready.unmount();
    const missing = render(null);
    expect(missing.get('.ew-status-pill').text()).toBe(tr.ui.ai.statusSetup);
    missing.unmount();
    const signedOut = render(disconnected);
    expect(signedOut.get('.ew-status-pill').text()).toBe(tr.ui.ai.statusAction);
    signedOut.unmount();
  });
});

describe('AI connection guide', () => {
  const guide = (mode: AiStatus['mode'] | null) =>
    mount(AiConnectionGuide, { props: { text: tr.ui.ai, mode } });

  it('lists what each method needs, opens the selected one and links to official setup pages', () => {
    const wrapper = guide('claude-code');
    const items = wrapper.findAll('details');
    expect(items.map((item) => item.attributes('data-mode'))).toEqual([
      'chatgpt',
      'api-key',
      'claude-code',
      'helper',
    ]);
    expect(items.map((item) => item.attributes('open') !== undefined)).toEqual([false, false, true, false]);

    const claude = items[2]!;
    expect(claude.text()).toContain(tr.ui.ai.guide.current);
    expect(claude.text()).toContain('Claude Pro, Max, Team veya Enterprise');
    // `claude` ve `/login` komut olarak gösterilir.
    expect(claude.findAll('code').map((code) => code.text())).toEqual(['claude', '/login']);
    expect(claude.get('a').attributes('href')).toBe('https://code.claude.com/docs/en/setup');
    expect(items[1]!.get('a').attributes('href')).toBe('https://platform.openai.com/api-keys');
    expect(items[0]!.text()).toContain('Plus veya Pro');
    expect(items[3]!.text()).toContain('Windows');
    wrapper.unmount();
  });

  it('opens nothing when no method is known yet', () => {
    const wrapper = guide(null);
    expect(wrapper.findAll('details[open]')).toHaveLength(0);
    wrapper.unmount();
  });
});
