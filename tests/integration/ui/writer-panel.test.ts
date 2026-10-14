import { mount } from '@vue/test-utils';
import {
  ContextInspector,
  provideUiText,
  ResultPreview,
  WriterPanel,
  type ContextView,
  type PanelView,
  type UiText,
} from '@email-writer/ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import { tr } from '../../../apps/browser-extension/src/locales/tr';

const emptyContext: ContextView = {
  status: 'not-loaded',
  required: false,
  needsReplyTarget: false,
  notices: [],
  messages: [],
  errorCode: null,
};

function view(overrides: Partial<PanelView> = {}): PanelView {
  return {
    operation: 'revise',
    target: { kind: 'composer', isReply: true },
    source: {
      origin: 'draft-selection',
      text: 'toplantı yarın olsun mu',
      instruction: '',
      edited: false,
      pendingReplace: null,
      canLoadDraft: true,
      canLoadSelection: true,
      canLoadReceivedSelection: false,
      isReading: false,
    },
    options: {
      targetLanguage: 'en',
      tone: 'neutral',
      showTargetLanguage: false,
      showTone: true,
      useConversation: false,
      showUseConversation: true,
    },
    context: emptyContext,
    fieldErrors: {},
    prepare: { canPrepare: false, blocker: 'PROCESSING_UNAVAILABLE', isPreparing: false },
    preview: null,
    apply: {
      mode: 'replace-selection',
      canApply: false,
      blocker: null,
      canCopy: false,
      canUndo: false,
      isApplying: false,
      canReplaceExistingReply: false,
      canUseOpenComposer: false,
    },
    status: { kind: 'none' },
    staleNotice: null,
    canStartNewWork: false,
    ...overrides,
  };
}

const textRef = ref<UiText>(tr.ui);

/** Bileşeni, eklentinin yaptığı gibi metin sözlüğü sağlanmış bir kökte bağlar. */
function withText(child: unknown, props: Record<string, unknown>, listeners: Record<string, unknown> = {}) {
  const Host = defineComponent({
    setup() {
      provideUiText(textRef);
      return () => h(child as never, { ...props, ...listeners });
    },
  });
  return mount(Host, { attachTo: document.body });
}

describe('WriterPanel', () => {
  it('erişilebilir, modal olmayan bir diyalog olarak açılır', () => {
    const wrapper = withText(WriterPanel, { view: view(), limits: { source: 20_000, instruction: 5_000 } });
    const dialog = wrapper.get('[role="dialog"]');
    const titleId = dialog.attributes('aria-labelledby');

    expect(titleId).toBeTruthy();
    expect(wrapper.get(`#${CSS.escape(titleId!)}`).text()).toBe('Yazma yardımcısı');
    expect(dialog.attributes('aria-modal')).toBeUndefined();
    wrapper.unmount();
  });

  it('metin işleme bağlı değilse düğmenin neden kapalı olduğunu açıklar', () => {
    const wrapper = withText(WriterPanel, { view: view(), limits: { source: 20_000, instruction: 5_000 } });
    const button = wrapper.get('.ew-prepare button');

    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Metin işleme henüz bağlanmadı');
    wrapper.unmount();
  });

  it('kullanıcı olaylarını dışarı verir ve Escape ile kapanır', async () => {
    const events: string[] = [];
    const wrapper = withText(
      WriterPanel,
      {
        view: view({ prepare: { canPrepare: true, blocker: null, isPreparing: false } }),
        limits: { source: 20_000, instruction: 5_000 },
      },
      {
        onPrepare: () => events.push('prepare'),
        onClose: () => events.push('close'),
        onSourceChange: (text: string) => events.push(`source:${text}`),
        onOperationChange: (operation: string) => events.push(`operation:${operation}`),
      },
    );

    await wrapper.get('.ew-prepare button').trigger('click');
    await wrapper.get('textarea').setValue('yeni metin');
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click');
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });

    expect(events).toEqual(['prepare', 'source:yeni metin', 'operation:translate', 'close']);
    wrapper.unmount();
  });

  it('yanıt hazırlamada talimat alanını ve hedef dili gösterir', () => {
    const wrapper = withText(WriterPanel, {
      view: view({
        operation: 'reply',
        options: { ...view().options, showTargetLanguage: true, showUseConversation: false },
        source: { ...view().source, instruction: 'Kibarca teşekkür et' },
      }),
      limits: { source: 20_000, instruction: 5_000 },
    });

    expect(wrapper.get('textarea').element.value).toBe('Kibarca teşekkür et');
    expect(wrapper.text()).toContain('Yanıt talimatı');
    expect(wrapper.find('select').exists()).toBe(true);
    wrapper.unmount();
  });

  it('kaynak yeniden alınırken düzenlenmiş metin için onay ister', () => {
    const wrapper = withText(WriterPanel, {
      view: view({ source: { ...view().source, edited: true, pendingReplace: 'draft' } }),
      limits: { source: 20_000, instruction: 5_000 },
    });

    expect(wrapper.text()).toContain('Paneldeki metniniz değiştirilecek.');
    expect(wrapper.text()).toContain('düzenlendi');
    wrapper.unmount();
  });
});

describe('ResultPreview', () => {
  it('örnek sonucu etiketler ve HTML çalıştırmaz', () => {
    const wrapper = withText(ResultPreview, {
      preview: {
        text: '<b>kalın</b><img src=x onerror=alert(1)>',
        sample: true,
        stale: false,
        unchanged: false,
      },
      error: null,
      disabled: false,
    });

    expect(wrapper.text()).toContain('Örnek sonuç — geliştirme modu');
    expect(wrapper.get('textarea').element.value).toBe('<b>kalın</b><img src=x onerror=alert(1)>');
    expect(wrapper.find('b').exists()).toBe(false);
    expect(wrapper.find('img').exists()).toBe(false);
    wrapper.unmount();
  });

  it('eski önizlemenin uygulanamayacağını açıklar', () => {
    const wrapper = withText(ResultPreview, {
      preview: { text: 'Metin', sample: false, stale: true, unchanged: false },
      error: null,
      disabled: false,
    });
    expect(wrapper.text()).toContain('kopyalanabilir ama taslağa uygulanamaz');
    wrapper.unmount();
  });
});

describe('ContextInspector', () => {
  const context: ContextView = {
    status: 'ready',
    required: true,
    needsReplyTarget: false,
    notices: [
      { kind: 'message-count', count: 2 },
      { kind: 'collapsed-unread', count: 1 },
      { kind: 'coverage-unverified' },
    ],
    messages: [
      {
        messageKey: 'm1',
        senderLabel: 'Mehmet Demir',
        sentAtText: 'Cum 11:00',
        preview: 'Merhaba Ayşe',
        text: 'Merhaba Ayşe',
        included: true,
        locked: false,
        isReplyTarget: false,
        omittedBlocks: [{ blockIndex: 1, kind: 'signature', text: 'Saygılarımla' }],
      },
      {
        messageKey: 'm2',
        senderLabel: null,
        sentAtText: null,
        preview: 'Hi',
        text: 'Hi',
        included: true,
        locked: true,
        isReplyTarget: true,
        omittedBlocks: [],
      },
    ],
    errorCode: null,
  };

  it('eksik kapsamı genel bir "hazır" mesajının arkasına saklamaz', () => {
    const wrapper = withText(ContextInspector, { context, disabled: false });

    expect(wrapper.text()).toContain('Bağlamda 2 mesaj var.');
    expect(wrapper.text()).toContain('1 mesaj kapalı; içerikleri okunmadı.');
    expect(wrapper.text()).toContain('mesajların tamamına erişildiği doğrulanamıyor');
    wrapper.unmount();
  });

  it('aktif mesajın seçimi kilitlidir; çıkarılan blok geri dahil edilebilir', async () => {
    const included: unknown[] = [];
    const wrapper = withText(
      ContextInspector,
      { context, disabled: false },
      {
        onBlockInclude: (key: string, index: number) => included.push([key, index]),
      },
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'İncele')!
      .trigger('click');
    const checkboxes = wrapper.findAll('input[type="checkbox"]');

    expect(checkboxes[1]!.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Gönderen okunamadı');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Geri dahil et')!
      .trigger('click');
    expect(included).toEqual([['m1', 1]]);
    wrapper.unmount();
  });

  it('aktif mesaj tanınamadıysa yanıt hedefini seçtirir', async () => {
    const chosen: string[] = [];
    const wrapper = withText(
      ContextInspector,
      { context: { ...context, needsReplyTarget: true }, disabled: false },
      { onReplyTargetChange: (key: string) => chosen.push(key) },
    );

    expect(wrapper.text()).toContain('Yanıt verilecek mesajı seçin');
    await wrapper.findAll('input[type="radio"]')[0]!.trigger('change');
    expect(chosen).toEqual(['m1']);
    wrapper.unmount();
  });
});
