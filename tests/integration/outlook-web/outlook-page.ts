import {
  createOutlookWebConnector,
  type EditorWriter,
  type OutlookWebConnection,
} from '@writehand/outlook-web';

import {
  createDomWriter,
  fixtureElement,
  loadFixture as loadMailFixture,
  OWN_UI_SELECTOR,
} from '../../support/mail-page';

export { createDomWriter, never, OWN_UI_SELECTOR, selectText, typeInto } from '../../support/mail-page';

export function loadFixture(name: string): void {
  loadMailFixture('outlook', name);
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
  return fixtureElement(fixtureName);
}
