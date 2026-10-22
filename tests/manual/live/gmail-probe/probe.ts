/**
 * Inspection entry point that runs on the real Gmail page in WebDriver BiDi's isolated
 * "sandbox" realm. Like a content script, the sandbox sees the page's DOM but does not touch
 * the page's JavaScript objects. It only reads: it never clicks, types or changes the page.
 *
 * All output is masked: no real email text, name or address is returned.
 */
import { createGmailWebConnector, GMAIL_SELECTORS } from '@writehand/gmail-web';

import { OWN_UI_SELECTOR } from '../../../../apps/browser-extension/src/bootstrap/mail-provider';
import { describeStructure } from '../probe/describe-structure';
import { readThreadReport } from '../probe/thread-report';

type SelectorKey = keyof typeof GMAIL_SELECTORS;

const messageBodySelector = GMAIL_SELECTORS.messageBody.selectors.join(', ');

const connect = () => createGmailWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR });

/** The target is a selector key (e.g. `threadView`) or a CSS selector; only a rendered match counts. */
function resolveRoot(target: string): Element | null {
  const selector = Object.hasOwn(GMAIL_SELECTORS, target)
    ? GMAIL_SELECTORS[target as SelectorKey].selectors.join(', ')
    : target;
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) =>
      element.checkVisibility(),
    ) ?? null
  );
}

export function structure(target = 'threadView', maxDepth = 40, maxLines = 400, showBodies = false) {
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

/** Match count of each selector under each key, all and rendered; carries no content. */
export function selectorMatches(key?: string) {
  const keys = (key === undefined ? Object.keys(GMAIL_SELECTORS) : [key]) as SelectorKey[];
  return keys
    .filter((name) => Object.hasOwn(GMAIL_SELECTORS, name))
    .map((name) => ({
      key: name,
      status: GMAIL_SELECTORS[name].status,
      selectors: GMAIL_SELECTORS[name].selectors.map((selector) => {
        const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
        return {
          selector,
          matches: all.length,
          rendered: all.filter((element) => element.checkVisibility()).length,
        };
      }),
    }));
}

export function readThread() {
  return readThreadReport(document, { connect, bodySelector: messageBodySelector });
}

/** What the connector sees of the drafts: whether each is a reply and bound to the conversation. */
export async function composers() {
  const { connector } = connect();
  try {
    const state = connector.getPageState();
    return Promise.all(
      state.composers.map(async (ref) => {
        const snapshot = await connector.readComposer(ref);
        return {
          boundToConversation: ref.threadKey !== null,
          editableLength: snapshot.ok ? snapshot.value.editableText.length : null,
          canReplaceBody: snapshot.ok ? snapshot.value.canReplaceBody : null,
          canInsertIntoEmptyBody: snapshot.ok ? snapshot.value.canInsertIntoEmptyBody : null,
          error: snapshot.ok ? null : snapshot.error.code,
        };
      }),
    );
  } finally {
    connector.dispose();
  }
}

/** Gmail's theme as the extension reads it; carries no content. */
export function theme() {
  const { connector, readTheme } = connect();
  try {
    return readTheme();
  } finally {
    connector.dispose();
  }
}
