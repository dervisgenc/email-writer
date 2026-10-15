import type {
  ApplyMode,
  ContextNotice,
  ErrorCode,
  LanguageCode,
  Operation,
  SourceOrigin,
  Tone,
} from '@email-writer/contracts';
import { inject, provide, type InjectionKey, type Ref } from 'vue';
import type { AiText } from './ai-text';

type CountedNotice = Extract<ContextNotice, { count: number }>['kind'];
type PlainNotice = Exclude<ContextNotice['kind'], CountedNotice>;

/**
 * Panelin bütün metinleri. Bileşenler metin üretmez; sözlük eklentinin
 * `locales/` dosyalarından sağlanır.
 */
export interface UiText {
  readonly ai: AiText;
  readonly panelTitle: string;
  readonly close: string;
  /** Okuma bölmesindeki "Yanıt hazırla" düğmesi. */
  readonly threadLauncher: {
    readonly label: string;
    readonly tooltip: string;
  };
  /** Yazma alanına gömülü araç çubuğu. */
  readonly compose: {
    readonly toolbarLabel: string;
    readonly reply: string;
    readonly replyTooltip: string;
    readonly write: string;
    readonly writeTooltip: string;
    readonly revise: string;
    readonly reviseTooltip: string;
    readonly translate: string;
    readonly translateTooltip: (language: string) => string;
    readonly chooseLanguage: string;
    readonly openPanel: string;
  };
  /** Yazma alanının yanındaki sonuç kartı. */
  readonly inline: {
    readonly titles: Readonly<Record<Operation, string>>;
    readonly instructionLabel: string;
    readonly instructionPlaceholder: string;
    readonly write: string;
    readonly contextChip: (count: number) => string;
    readonly contextReading: string;
    readonly openPanel: string;
    readonly translatedTo: (language: string) => string;
  };
  readonly operations: Readonly<Record<Operation, string>>;
  readonly prepareButton: Readonly<Record<Operation, string>>;
  readonly target: {
    readonly label: string;
    readonly none: string;
    readonly composer: string;
    readonly replyComposer: string;
    readonly receivedMessage: string;
  };
  readonly source: {
    readonly textLabel: string;
    readonly instructionLabel: string;
    readonly composeInstructionLabel: string;
    readonly originLabel: string;
    readonly origins: Readonly<Record<SourceOrigin, string>>;
    readonly edited: string;
    readonly placeholders: Readonly<Record<Operation, string>>;
    readonly loadDraft: string;
    readonly loadSelection: string;
    readonly loadReceivedSelection: string;
    readonly confirmReplace: string;
    readonly confirm: string;
    readonly cancel: string;
    readonly characters: (count: number, limit: number) => string;
  };
  readonly options: {
    readonly targetLanguage: string;
    readonly tone: string;
    readonly tones: Readonly<Record<Tone, string>>;
    readonly languages: Readonly<Record<LanguageCode, string>>;
    readonly useConversation: string;
  };
  readonly context: {
    readonly title: string;
    readonly summary: (included: number, total: number) => string;
    readonly refresh: string;
    readonly read: string;
    readonly reading: string;
    readonly notLoaded: string;
    readonly stale: string;
    readonly activeLocked: string;
    readonly chooseReplyTarget: string;
    readonly replyTarget: string;
    readonly unknownSender: string;
    readonly currentGroup: string;
    readonly otherGroup: (count: number) => string;
    readonly otherHint: string;
    readonly includeMessage: (sender: string) => string;
    readonly replyTargetBadge: string;
    readonly editedBadge: string;
    readonly showBody: string;
    readonly hideBody: string;
    readonly edit: string;
    readonly editLabel: string;
    readonly save: string;
    readonly cancelEdit: string;
    readonly resetEdit: string;
    readonly omittedBlock: Readonly<Record<'signature' | 'quote', string>>;
    readonly includeBlock: string;
    readonly counted: Readonly<Record<CountedNotice, (count: number) => string>>;
    readonly plain: Readonly<Record<PlainNotice, string>>;
  };
  readonly preview: {
    readonly title: string;
    readonly regenerate: string;
    readonly sampleLabel: string;
    /** Dar alanlarda (sonuç kartı) gösterilen kısa etiket; tam açıklama ipucunda kalır. */
    readonly sampleShort: string;
    readonly stale: string;
    readonly unchanged: string;
  };
  readonly apply: {
    readonly scopeLabel: string;
    readonly scopes: Readonly<Record<ApplyMode, string>>;
    readonly noTarget: string;
    readonly formattingNote: string;
    readonly copy: string;
    readonly apply: string;
    readonly undo: string;
    readonly replaceExistingReply: string;
    readonly useOpenComposer: string;
  };
  readonly status: {
    readonly reading: string;
    readonly preparing: string;
    readonly applying: string;
    readonly undoing: string;
    readonly applied: string;
    readonly undone: string;
    readonly copied: string;
    readonly retry: string;
    readonly dismiss: string;
  };
  readonly errors: Readonly<Record<ErrorCode, string>>;
}

const UI_TEXT_KEY: InjectionKey<Readonly<Ref<UiText>>> = Symbol('email-writer-ui-text');

export function provideUiText(text: Readonly<Ref<UiText>>): void {
  provide(UI_TEXT_KEY, text);
}

export function useUiText(): Readonly<Ref<UiText>> {
  const text = inject(UI_TEXT_KEY);
  if (text === undefined) {
    throw new Error('UiText sağlanmadı: provideUiText çağrılmalı.');
  }
  return text;
}

export function describeNotice(text: UiText, notice: ContextNotice): string {
  return 'count' in notice
    ? text.context.counted[notice.kind](notice.count)
    : text.context.plain[notice.kind];
}
