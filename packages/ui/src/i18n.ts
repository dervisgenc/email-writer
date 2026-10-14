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

type CountedNotice = Extract<ContextNotice, { count: number }>['kind'];
type PlainNotice = Exclude<ContextNotice['kind'], CountedNotice>;

/**
 * Panelin bütün metinleri. Bileşenler metin üretmez; sözlük eklentinin
 * `locales/` dosyalarından sağlanır.
 */
export interface UiText {
  readonly panelTitle: string;
  readonly close: string;
  readonly newWork: {
    readonly offer: string;
    readonly start: string;
  };
  readonly launcher: {
    readonly label: string;
    readonly tooltip: string;
    readonly quickRevise: string;
    readonly quickTranslate: string;
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
    readonly inspect: string;
    readonly hide: string;
    readonly refresh: string;
    readonly read: string;
    readonly reading: string;
    readonly notLoaded: string;
    readonly stale: string;
    readonly activeLocked: string;
    readonly chooseReplyTarget: string;
    readonly replyTarget: string;
    readonly unknownSender: string;
    readonly showBody: string;
    readonly hideBody: string;
    readonly omittedBlock: Readonly<Record<'signature' | 'quote', string>>;
    readonly includeBlock: string;
    readonly counted: Readonly<Record<CountedNotice, (count: number) => string>>;
    readonly plain: Readonly<Record<PlainNotice, string>>;
  };
  readonly preview: {
    readonly title: string;
    readonly sampleLabel: string;
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
