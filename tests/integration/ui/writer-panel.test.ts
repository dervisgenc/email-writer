import { mount } from '@vue/test-utils';
import {
  ComposeToolbar,
  ContextInspector,
  InlineAssistant,
  provideUiText,
  ResultPreview,
  WriterPanel,
  type ContextMessageView,
  type ContextView,
  type PanelView,
  type QuickActionRequest,
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
    writeOperation: 'reply',
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
    refine: { available: false, rich: true },
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
    // Sıra: Yanıt hazırla, Düzelt, Çevir.
    await wrapper.findAll('[role="radio"]')[2]!.trigger('click');
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
      contextMessage({
        messageKey: 'm1',
        senderLabel: 'Mehmet Demir',
        sentAtText: 'Cum 11:00',
        preview: 'Merhaba Ayşe',
        text: 'Merhaba Ayşe',
        omittedBlocks: [{ blockIndex: 1, kind: 'signature', text: 'Saygılarımla' }],
      }),
      contextMessage({
        messageKey: 'm2',
        senderLabel: null,
        preview: 'Hi',
        text: 'Hi',
        locked: true,
        isReplyTarget: true,
      }),
    ],
    errorCode: null,
  };

  it('eksik kapsamı genel bir "hazır" mesajının arkasına saklamaz', () => {
    const wrapper = withText(ContextInspector, { context, disabled: false });

    expect(wrapper.text()).toContain('2/2 mesaj kullanılıyor');
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

  it('başka konuşmalardan açılanları ayrı ve kapalı bir grupta gösterir; işaretleyince bağlama ekler', async () => {
    const changes: unknown[] = [];
    const wrapper = withText(
      ContextInspector,
      {
        context: {
          ...context,
          messages: [
            ...context.messages,
            contextMessage({ messageKey: 'o1', group: 'other', included: false, subject: 'Fatura' }),
          ],
        },
        disabled: false,
      },
      { onContextSelectionChange: (key: string, included: boolean) => changes.push([key, included]) },
    );

    expect(wrapper.text()).toContain('Bu konuşma');
    const toggle = wrapper.findAll('button').find((b) => b.text().includes('Diğer açılan e-postalar (1)'))!;
    expect(toggle.attributes('aria-expanded')).toBe('false');
    await toggle.trigger('click');
    expect(wrapper.text()).toContain('Fatura');

    const otherCheckbox = wrapper.findAll('input[type="checkbox"]')[2]!;
    (otherCheckbox.element as HTMLInputElement).checked = true;
    await otherCheckbox.trigger('change');
    expect(changes).toEqual([['o1', true]]);
    wrapper.unmount();
  });

  it('mesaj metni düzenlenip kaydedilir veya orijinale döndürülür', async () => {
    const edits: unknown[] = [];
    const wrapper = withText(
      ContextInspector,
      {
        context: {
          ...context,
          messages: [contextMessage({ messageKey: 'm1', text: 'Uzun metin', edited: true })],
        },
        disabled: false,
      },
      { onContextTextChange: (key: string, text: string | null) => edits.push([key, text]) },
    );

    await wrapper.get('button[aria-label="Düzenle"]').trigger('click');
    const editor = wrapper.get('textarea');
    expect((editor.element as HTMLTextAreaElement).value).toBe('Uzun metin');
    await editor.setValue('Kısa metin');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Kaydet')!
      .trigger('click');

    await wrapper.get('button[aria-label="Düzenle"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Orijinale dön'))!
      .trigger('click');

    expect(edits).toEqual([
      ['m1', 'Kısa metin'],
      ['m1', null],
    ]);
    expect(wrapper.text()).toContain('Düzenlendi');
    wrapper.unmount();
  });
});

describe('ComposeToolbar', () => {
  function toolbar(
    props: Partial<{ isReply: boolean; busyOperation: string | null; defaultLanguage: string }> = {},
  ) {
    const requests: unknown[] = [];
    const wrapper = withText(
      ComposeToolbar,
      {
        isReply: true,
        busyOperation: null,
        defaultLanguage: 'en',
        favoriteLanguages: ['en', 'tr', 'de', 'pt-BR', 'Kurmancî'],
        ...props,
      },
      {
        onQuickAction: (request: QuickActionRequest) => requests.push(request),
        onOpenPanel: () => requests.push('panel'),
        onManageLanguages: () => requests.push('languages'),
      },
    );
    return { wrapper, requests };
  }

  it('yanıt taslağında Yanıt yaz, Düzelt ve Çevir işlemlerini doğrudan ister', async () => {
    const { wrapper, requests } = toolbar();
    const button = (label: string) => wrapper.findAll('button').find((b) => b.text() === label)!;

    await button('Yanıt yaz').trigger('click');
    await button('Düzelt').trigger('click');
    await button('Çevir').trigger('click');
    await wrapper.get('button[aria-label="Yazma yardımcısını panelde aç"]').trigger('click');

    expect(requests).toEqual([
      { operation: 'reply' },
      { operation: 'revise' },
      { operation: 'translate', language: 'en' },
      'panel',
    ]);
    expect(wrapper.get('[role="toolbar"]').attributes('aria-label')).toBe('Email Writer');
    wrapper.unmount();
  });

  it('yeni iletide "Yanıt yaz" yerine "Yaz" gösterir; dil menüsünden başka bir dile çevirir', async () => {
    const { wrapper, requests } = toolbar({ isReply: false });

    expect(wrapper.text()).not.toContain('Yanıt yaz');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Yaz')!
      .trigger('click');
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click');
    const german = wrapper.findAll('[role="menuitemradio"]').find((item) => item.text() === 'Almanca')!;
    await german.trigger('click');

    expect(requests).toEqual([{ operation: 'compose' }, { operation: 'translate', language: 'de' }]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('Çevir menüsü varsayılan dili başta, favorileri yerelleştirilmiş adlarıyla ve elle yazılan dili olduğu gibi gösterir', async () => {
    const { wrapper, requests } = toolbar({ defaultLanguage: 'de' });
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click');

    const items = wrapper.findAll('[role="menuitemradio"]').map((item) => item.text());
    expect(items).toEqual(['Almanca', 'İngilizce', 'Türkçe', 'Brezilya Portekizcesi', 'Kurmancî']);
    const actions = wrapper.findAll('[role="menuitem"]');
    await actions[0]!.trigger('click');
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click');
    await wrapper.findAll('[role="menuitem"]')[1]!.trigger('click');

    // "Başka bir dil…" dili sormak için dilsiz çeviri ister; "Dilleri düzenle" ayarları açar.
    expect(requests).toEqual([{ operation: 'translate', language: null }, 'languages']);
    wrapper.unmount();
  });

  it('bir işlem çalışırken düğmeler kapanır ve çalışan işlemde ilerleme gösterilir', () => {
    const { wrapper } = toolbar({ busyOperation: 'revise' });

    for (const button of wrapper.findAll('[role="toolbar"] > button, .ew-bar-split > button')) {
      if (button.attributes('aria-label') !== 'Yazma yardımcısını panelde aç') {
        expect(button.attributes('disabled')).toBeDefined();
      }
    }
    expect(wrapper.find('.ew-spinner').exists()).toBe(true);
    wrapper.unmount();
  });
});

describe('InlineAssistant', () => {
  it('yanıt kartı talimatı Enter ile gönderir ve bağlam sayısını gösterir', async () => {
    const submitted: string[] = [];
    const wrapper = withText(
      InlineAssistant,
      {
        view: view({
          operation: 'reply',
          prepare: { canPrepare: true, blocker: null, isPreparing: false },
          context: {
            ...emptyContext,
            status: 'ready',
            required: true,
            messages: [
              contextMessage({ messageKey: 'm1' }),
              contextMessage({ messageKey: 'm2', included: false }),
            ],
          },
        }),
      },
      { onSubmitInstruction: (text: string) => submitted.push(text) },
    );

    expect(wrapper.text()).toContain('Yanıt taslağı');
    expect(wrapper.text()).toContain('Bağlam · 1 mesaj');
    const field = wrapper.get('textarea');
    await field.setValue('Perşembe uygun de');
    await field.trigger('keydown', { key: 'Enter' });

    expect(submitted).toEqual(['Perşembe uygun de']);
    wrapper.unmount();
  });

  it('sonucu gösterir; Uygula, Kopyala ve Geri al olaylarını verir', async () => {
    const events: string[] = [];
    const wrapper = withText(
      InlineAssistant,
      {
        view: view({
          preview: { text: 'Toplantıyı yarın yapabiliriz.', sample: true, stale: false, unchanged: false },
          apply: { ...view().apply, canApply: true, canCopy: true, canUndo: true },
        }),
      },
      {
        onApply: () => events.push('apply'),
        onCopy: () => events.push('copy'),
        onUndo: () => events.push('undo'),
        onClose: () => events.push('close'),
      },
    );

    expect(wrapper.text()).toContain('Düzeltme önerisi');
    expect(wrapper.get('.ew-badge--sample').attributes('aria-label')).toBe('Örnek sonuç — geliştirme modu');
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      'Toplantıyı yarın yapabiliriz.',
    );
    const button = (label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))!;
    await button('Taslağa uygula').trigger('click');
    await button('Kopyala').trigger('click');
    await button('Son uygulamayı geri al').trigger('click');
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });

    expect(events).toEqual(['apply', 'copy', 'undo', 'close']);
    wrapper.unmount();
  });

  it('hazırlanırken ilerlemeyi, engel varken nedenini gösterir', () => {
    const busy = withText(InlineAssistant, {
      view: view({ status: { kind: 'busy', activity: 'preparing' } }),
    });
    expect(busy.text()).toContain('İşlem hazırlanıyor…');
    busy.unmount();

    const blocked = withText(InlineAssistant, { view: view() });
    expect(blocked.text()).toContain('Metin işleme henüz bağlanmadı');
    blocked.unmount();
  });
});

function contextMessage(overrides: Partial<ContextMessageView> & { messageKey: string }): ContextMessageView {
  return {
    senderLabel: `Gönderen ${overrides.messageKey}`,
    sentAtText: null,
    subject: null,
    group: 'current',
    preview: 'Önizleme',
    text: 'Metin',
    included: true,
    edited: false,
    locked: false,
    isReplyTarget: false,
    omittedBlocks: [],
    ...overrides,
  };
}
