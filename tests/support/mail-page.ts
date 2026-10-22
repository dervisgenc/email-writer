import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EditorWriter } from '@writehand/mail-dom';

/** Selector of the extension's own UI roots, as the content scripts pass it to a connector. */
export const OWN_UI_SELECTOR = '[data-writehand-ui]';

export const never = { aborted: false };

/** Puts a synthetic page from `tests/fixtures/<folder>/` into the test document. */
export function loadFixture(folder: string, name: string): void {
  // Tests run from the repository root (vitest.config.ts).
  document.body.innerHTML = readFileSync(resolve(process.cwd(), 'tests/fixtures', folder, name), 'utf8');
}

/**
 * The editor writer for the test environment. jsdom lacks the `execCommand` method used in
 * real mail editors, so this writer replaces the range with DOM operations. The connector's
 * pre-check and post-write verification rules work unchanged with it.
 */
export function createDomWriter(): EditorWriter & { calls: number } {
  const writer = {
    id: 'test-dom-writer',
    calls: 0,
    replaceRange(_editor: HTMLElement, range: Range, text: string) {
      writer.calls += 1;
      range.deleteContents();
      if (text.length > 0) {
        range.insertNode(range.startContainer.ownerDocument!.createTextNode(text));
      }
      return true;
    },
    insertHtml(_editor: HTMLElement, range: Range, html: string) {
      writer.calls += 1;
      range.deleteContents();
      range.insertNode(range.createContextualFragment(html));
      return true;
    },
  };
  return writer;
}

/** The fixture element marked `data-fixture="<name>"`. */
export function fixtureElement(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-fixture="${name}"]`);
  if (element === null) {
    throw new Error(`Fixture element not found: ${name}`);
  }
  return element;
}

/** Selects a phrase from a text node in the document. */
export function selectText(root: Element, phrase: string, occurrence = 0): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    let index = text.indexOf(phrase);
    while (index >= 0) {
      if (seen === occurrence) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + phrase.length);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      seen += 1;
      index = text.indexOf(phrase, index + 1);
    }
  }
  throw new Error(`Phrase not found: ${phrase}`);
}

/** Simulates the user typing in the editor (observers see the DOM change). */
export function typeInto(target: HTMLElement, text: string): void {
  target.querySelector('div')?.append(document.createTextNode(text));
}
