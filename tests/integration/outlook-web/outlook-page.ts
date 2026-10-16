import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createOutlookWebConnector,
  type EditorWriter,
  type OutlookWebConnection,
} from '@email-writer/outlook-web';

export const OWN_UI_SELECTOR = '[data-email-writer-ui]';

export function loadFixture(name: string): void {
  // Testler depo kökünden çalıştırılır (vitest.config.ts).
  const html = readFileSync(resolve(process.cwd(), 'tests/fixtures/outlook', name), 'utf8');
  document.body.innerHTML = html;
}

/**
 * Test ortamının editör yazıcısı. Gerçek Outlook editöründe kullanılan
 * `execCommand` yöntemi jsdom'da bulunmadığı için, aralığı DOM işlemleriyle
 * değiştirir. Bağlantının ön kontrol ve sonradan doğrulama kuralları bu
 * yazıcıyla da aynen çalışır.
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

let counter = 0;

export function createConnection(writer: EditorWriter = createDomWriter()): OutlookWebConnection {
  return createOutlookWebConnector({
    document,
    ownUiSelector: OWN_UI_SELECTOR,
    createId: () => `id-${(counter += 1)}`,
    now: () => new Date('2026-10-13T10:00:00.000Z'),
    writer,
    settle: () => Promise.resolve(),
  });
}

export function editor(fixtureName = 'reply-editor'): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-fixture="${fixtureName}"]`);
  if (element === null) {
    throw new Error(`Örnek editör bulunamadı: ${fixtureName}`);
  }
  return element;
}

/** Bir metin düğümündeki ifadeyi belgede seçer. */
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
  throw new Error(`İfade bulunamadı: ${phrase}`);
}

/** Kullanıcının editörde yazmasını taklit eder (gözlemciler DOM değişikliğini görür). */
export function typeInto(target: HTMLElement, text: string): void {
  target.querySelector('div')?.append(document.createTextNode(text));
}

export const never = { aborted: false };
