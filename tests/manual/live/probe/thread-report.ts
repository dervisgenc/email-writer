import type {
  ContextCoverage,
  MailConnector,
  PageSupport,
  TextBlock,
  ThreadSnapshot,
} from '@writehand/contracts';

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

/** Non-whitespace character counts of the extracted text and of the text the browser shows. */
export interface TextCoverage {
  readonly extracted: number;
  readonly rendered: number;
}

export interface SelectorCount {
  readonly key: string;
  readonly status: 'candidate' | 'verified';
  readonly matches: number;
}

export interface ThreadReport {
  readonly support: PageSupport;
  /** The connector's conversation key (opaque hash); its prefix shows where it came from. */
  readonly threadKey: string | null;
  readonly selectors: readonly SelectorCount[];
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

/** Visible text of the innermost message bodies, found with the connector's own selector. */
function renderedBodyText(document: Document, bodySelector: string): number {
  const all = Array.from(document.querySelectorAll<HTMLElement>(bodySelector));
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
 * Runs a connector on the page, reads the open conversation and turns the result into a
 * masked report. The connector is created on every call and disposed at the end; it leaves
 * no trace on the page.
 */
export async function readThreadReport(
  document: Document,
  options: {
    readonly connect: () => { connector: MailConnector; selectorReport(): readonly SelectorCount[] };
    readonly bodySelector: string;
  },
): Promise<ThreadReport> {
  const { connector, selectorReport } = options.connect();
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
    return {
      ...base,
      thread: describeThread(result.value, renderedBodyText(document, options.bodySelector)),
    };
  } finally {
    connector.dispose();
  }
}
