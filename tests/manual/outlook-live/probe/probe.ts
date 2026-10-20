/**
 * Inspection entry point that runs on the real Outlook page in WebDriver BiDi's
 * isolated "sandbox" realm. Like a content script, the sandbox sees the page's
 * DOM but does not touch the page's JavaScript objects.
 *
 * All output is masked: no real email text, name or address is returned.
 */
import { createOutlookWebConnector, OUTLOOK_SELECTORS } from '@writehand/outlook-web';

import { OWN_UI_SELECTOR } from '../../../../apps/browser-extension/src/bootstrap/mail-provider';

import { describeStructure } from './describe-structure';
import { conversationRows, describeRows } from './message-list';
import { readThreadReport } from './read-thread-report';

const messageBodySelector = OUTLOOK_SELECTORS.messageBody.selectors.join(', ');

/** The target is a selector key (e.g. `readingPane`) or a CSS selector. */
function resolveRoot(target: string): Element | null {
  const selector = Object.hasOwn(OUTLOOK_SELECTORS, target)
    ? OUTLOOK_SELECTORS[target as keyof typeof OUTLOOK_SELECTORS].selectors.join(', ')
    : target;
  return document.querySelector(selector);
}

export function structure(target = 'readingPane', maxDepth = 40, maxLines = 400, showBodies = false) {
  const root = resolveRoot(target);
  if (root === null) {
    return { found: false, lines: [] };
  }
  return {
    found: true,
    lines: describeStructure(root, {
      maxDepth,
      maxLines,
      // The email body is not expanded unless its structure is needed.
      collapse: showBodies ? ':not(*)' : messageBodySelector,
    }),
  };
}

/** Match count of each selector under the selector keys, separately; carries no content. */
export function selectorMatches(key?: string) {
  const keys = (
    key === undefined ? Object.keys(OUTLOOK_SELECTORS) : [key]
  ) as (keyof typeof OUTLOOK_SELECTORS)[];
  return keys
    .filter((name) => Object.hasOwn(OUTLOOK_SELECTORS, name))
    .map((name) => ({
      key: name,
      status: OUTLOOK_SELECTORS[name].status,
      selectors: OUTLOOK_SELECTORS[name].selectors.map((selector) => ({
        selector,
        matches: document.querySelectorAll(selector).length,
      })),
    }));
}

export function rows(selector?: string) {
  return describeRows(document, selector);
}

/** Action buttons in a row (delete, archive, flag, checkbox) must not be clicked. */
const ROW_ACTION_SELECTOR = 'button, [role="button"], [role="checkbox"], input, a[href]';

/** How long to wait for the virtual list to redraw after scrolling. */
const SCROLL_SETTLE_MS = 400;

/**
 * Conversation ID of the row to click. Scrolling the virtual list changes the DOM
 * order of the rows, so the target is tracked by ID, not by position. The ID stays
 * inside the sandbox and is never written to the output.
 */
let targetConversation: string | null = null;

function rowByConversation(conversationId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[role="option"][data-convid="${CSS.escape(conversationId)}"]`);
}

/** A click point inside the row that hits no action button (viewport coordinates). */
function safePointIn(row: HTMLElement): { x: number; y: number } | null {
  const rect = row.getBoundingClientRect();
  const y = Math.round(rect.top + rect.height / 2);
  for (const ratio of [0.4, 0.5, 0.3, 0.6, 0.25]) {
    const x = Math.round(rect.left + rect.width * ratio);
    const hit = document.elementFromPoint(x, y);
    if (hit !== null && row.contains(hit) && hit.closest(ROW_ACTION_SELECTOR) === null) {
      return { x, y };
    }
  }
  return null;
}

/**
 * Scrolls the row into view, finds it again by ID once the list has redrawn, and
 * returns a safe click point. The real mouse event is sent to this point over
 * BiDi right after.
 */
export async function rowClickPoint(
  index: number,
  selector?: string,
): Promise<{ x: number; y: number } | null> {
  const conversationId = conversationRows(document, selector)[index]?.getAttribute('data-convid') ?? null;
  targetConversation = conversationId;
  const row = conversationId === null ? null : rowByConversation(conversationId);
  if (conversationId === null || row === null) {
    return null;
  }
  row.scrollIntoView({ block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));
  const settled = rowByConversation(conversationId);
  return settled === null ? null : safePointIn(settled);
}

/** Is the last targeted row selected? If not, the opened conversation is not read. */
export function targetRowSelected(): boolean {
  const row = targetConversation === null ? null : rowByConversation(targetConversation);
  return row?.getAttribute('aria-selected') === 'true';
}

/**
 * Fingerprint of the message shown in the reading pane: the IDs of the subject and
 * sender headings. It has a value only once the pane has finished rendering (subject,
 * sender and body all present). The IDs never leave the sandbox.
 */
function readingPaneFingerprint(): string | null {
  const pane = document.querySelector(OUTLOOK_SELECTORS.readingPane.selectors.join(', '));
  const subject = pane?.querySelector(OUTLOOK_SELECTORS.subject.selectors.join(', '));
  const sender = pane?.querySelector(OUTLOOK_SELECTORS.messageSender.selectors.join(', '));
  const body = pane?.querySelector(messageBodySelector);
  return subject && sender && body ? `${subject.id}|${sender.id}` : null;
}

let markedFingerprint: string | null = null;

/** Marks the state of the reading pane before the click. */
export function markReadingPane(): void {
  markedFingerprint = readingPaneFingerprint();
}

/** Has the reading pane fully rendered a new message since the mark? */
export function readingPaneChanged(): boolean {
  const current = readingPaneFingerprint();
  return current !== null && current !== markedFingerprint;
}

export function readThread() {
  return readThreadReport(document);
}

/** Outlook's theme colors (read with the extension's own reader); carries no content. */
export function theme() {
  const { connector, readTheme } = createOutlookWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR });
  try {
    return readTheme();
  } finally {
    connector.dispose();
  }
}

/**
 * Position of the extension's buttons on the page and the Outlook buttons beneath them.
 * For checking overlap without reading content: only roles and positions are returned.
 */
export function launcherLayout() {
  const hosts = Array.from(document.querySelectorAll('writehand-launcher'));
  return hosts.map((host) => {
    const container = host.shadowRoot?.querySelector<HTMLElement>('.ew-root')?.parentElement ?? null;
    const box = container?.getBoundingClientRect();
    const kind = host.shadowRoot?.querySelector('.ew-compose-bar') ? 'compose-toolbar' : 'thread-launcher';
    if (box === undefined || box.width === 0) {
      return { kind, visible: false, overlaps: [] };
    }
    const overlaps = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], [role="menuitem"]'),
    )
      .filter((element) => !element.closest('writehand-launcher'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top
        );
      })
      .map((element) => element.getAttribute('role') ?? element.tagName.toLowerCase());
    return {
      kind,
      visible: true,
      box: {
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
      viewport: { width: innerWidth, height: innerHeight },
      overlaps,
    };
  });
}

/** Short hash (FNV-1a) for comparing an ID without showing it. */
function shortHash(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

let watched: {
  connector: ReturnType<typeof createOutlookWebConnector>['connector'];
  events: string[];
} | null = null;

/** Content-free state of the connector and the reading pane (for diagnosis). */
function watchedState() {
  const state = watched?.connector.getPageState();
  const pane = document.querySelector('#ReadingPaneContainerId');
  const editor =
    pane?.querySelector('[role="textbox"][contenteditable="true"][aria-multiline="true"]') ?? null;
  const row = document.querySelector('[role="option"][aria-selected="true"][data-convid]');
  return {
    thread: state?.activeThread?.threadKey ?? null,
    composers: state?.composers.map((composer) => composer.threadKey ?? 'new') ?? [],
    bodies: pane?.querySelectorAll(messageBodySelector).length ?? 0,
    editor: editor !== null,
    quote: editor?.querySelector('[id$="divRplyFwdMsg"], [id$="appendonsend"]') !== null && editor !== null,
    selectedRow: shortHash(row?.getAttribute('data-convid') ?? null),
  };
}

/**
 * Diagnosis: starts the connector the extension uses on the page and records its events.
 * `watchState` reads the state and events; `watchStop` cleans up.
 */
export function watchStart() {
  watched?.connector.dispose();
  const { connector } = createOutlookWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR });
  const events: string[] = [];
  connector.subscribe((event) => {
    events.push(
      event.type === 'active-thread-changed'
        ? `${event.type}(${event.current?.threadKey ?? 'null'})`
        : 'ref' in event
          ? `${event.type}(${event.ref.threadKey ?? 'new'})`
          : event.type,
    );
  });
  watched = { connector, events };
  return watchedState();
}

export function watchState() {
  const state = watchedState();
  const events = watched?.events.splice(0) ?? [];
  return { ...state, events };
}

export function watchStop(): void {
  watched?.connector.dispose();
  watched = null;
}

/** Safe click point of the "Reply" button in the reading pane, or `null` if there is none. */
export function replyClickPoint(): { x: number; y: number } | null {
  const pane = document.querySelector('#ReadingPaneContainerId');
  const target = Array.from(pane?.querySelectorAll<HTMLElement>('button, [role="menuitem"]') ?? []).find(
    (element) => element.getAttribute('aria-label') === 'Reply' && element.getBoundingClientRect().width > 0,
  );
  if (target === undefined) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const hit = document.elementFromPoint(x, y);
  return hit !== null && target.contains(hit) ? { x, y } : null;
}
