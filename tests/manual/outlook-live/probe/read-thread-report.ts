import type { ContextCoverage, PageSupport, TextBlock, ThreadSnapshot } from '@email-writer/contracts';
import {
  createOutlookWebConnector,
  OUTLOOK_SELECTORS,
  type SelectorReportEntry,
} from '@email-writer/outlook-web';

import { OWN_UI_SELECTOR } from '../../../../apps/browser-extension/src/bootstrap/mail-provider';
import { maskText } from './mask-text';

export interface BlockReport {
  readonly kind: TextBlock['kind'];
  readonly certainty: TextBlock['certainty'];
  readonly length: number;
  readonly shape: string;
}

export interface MessageReport {
  readonly order: number;
  readonly sender: string | null;
  readonly sentAt: string | null;
  readonly sentAtText: string | null;
  readonly blocks: readonly BlockReport[];
}

/** Okunan metin ile tarayıcının gösterdiği metnin boşluksuz karakter sayıları. */
export interface TextCoverage {
  readonly extracted: number;
  readonly rendered: number;
}

export interface ThreadReport {
  readonly support: PageSupport;
  /** Bağlantının konuşma anahtarı (opak özet); kaynağı ön ekinden anlaşılır (conv/url/thread-local). */
  readonly threadKey: string | null;
  readonly selectors: readonly SelectorReportEntry[];
  readonly thread:
    | {
        readonly subject: string | null;
        readonly activeMessage: number | null;
        readonly coverage: ContextCoverage;
        readonly messages: readonly MessageReport[];
        readonly text: TextCoverage;
      }
    | { readonly error: string }
    | null;
}

const countVisibleCharacters = (text: string) => text.replace(/\s+/g, '').length;

/** Okuma bölmesindeki en içteki mesaj gövdeleri; bağlantının kullandığı seçicilerle. */
function renderedBodyText(document: Document): number {
  const selector = OUTLOOK_SELECTORS.messageBody.selectors.join(', ');
  const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return all
    .filter((element) => !all.some((other) => other !== element && element.contains(other)))
    .reduce((total, body) => total + countVisibleCharacters(body.innerText), 0);
}

function describeThread(snapshot: ThreadSnapshot, rendered: number): NonNullable<ThreadReport['thread']> {
  const messages = snapshot.messages.map((message) => ({
    order: message.displayOrder,
    sender: message.senderLabel === null ? null : maskText(message.senderLabel, 40),
    sentAt: message.sentAt,
    sentAtText: message.sentAtText === null ? null : maskText(message.sentAtText, 40),
    blocks: message.blocks.map((block) => ({
      kind: block.kind,
      certainty: block.certainty,
      length: block.text.length,
      shape: maskText(block.text, 120),
    })),
  }));
  const extracted = snapshot.messages
    .flatMap((message) => message.blocks)
    .reduce((total, block) => total + countVisibleCharacters(block.text), 0);
  const activeIndex = snapshot.messages.findIndex(
    (message) => message.messageKey === snapshot.activeMessageKey,
  );
  return {
    subject: snapshot.subject === null ? null : maskText(snapshot.subject, 60),
    activeMessage: activeIndex === -1 ? null : activeIndex,
    coverage: snapshot.coverage,
    messages,
    text: { extracted, rendered },
  };
}

/**
 * Eklentinin kullandığı Outlook bağlantısını sayfada çalıştırır, açık
 * konuşmayı okur ve sonucu maskeli rapora çevirir. Bağlantı her çağrıda
 * yeniden kurulur ve sonunda temizlenir; sayfada iz bırakmaz.
 */
export async function readThreadReport(document: Document): Promise<ThreadReport> {
  const { connector, selectorReport } = createOutlookWebConnector({
    document,
    ownUiSelector: OWN_UI_SELECTOR,
  });
  try {
    const state = connector.getPageState();
    const base = {
      support: state.support,
      threadKey: state.activeThread?.threadKey ?? null,
      selectors: selectorReport(),
    };
    if (state.activeThread === null) {
      return { ...base, thread: null };
    }
    const result = await connector.readThread(state.activeThread, { aborted: false });
    if (!result.ok) {
      return { ...base, thread: { error: result.error.code } };
    }
    return { ...base, thread: describeThread(result.value, renderedBodyText(document)) };
  } finally {
    connector.dispose();
  }
}
