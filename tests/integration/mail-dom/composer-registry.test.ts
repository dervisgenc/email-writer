import type { MailEvent } from '@writehand/contracts';
import {
  createComposerRegistry,
  createIdentityRegistry,
  innermostElements,
  isDarkBackground,
  outermostElements,
  type ComposerRegistry,
  type ElementRole,
} from '@writehand/mail-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const OWN_UI = '[data-writehand-ui]';

/** A generic editor with the user's text and a signature; no mail service's markup. */
function addEditor(id: string, text: string): HTMLElement {
  const editor = document.createElement('div');
  editor.setAttribute('contenteditable', 'true');
  editor.dataset.fixture = id;
  editor.innerHTML = `<div>${text}</div><div class="signature">Ece Yılmaz</div>`;
  document.body.append(editor);
  return editor;
}

const classify = (element: Element): ElementRole => (element.matches('.signature') ? 'signature' : null);

describe('mail-dom composer registry', () => {
  let events: MailEvent[];
  let composers: ComposerRegistry;
  let counter = 0;

  beforeEach(() => {
    events = [];
    const registry = createIdentityRegistry('test-mail', () => `id-${(counter += 1)}`);
    registry.updateAccountHint('synthetic account');
    composers = createComposerRegistry({
      document,
      registry,
      classify,
      ownUiSelector: OWN_UI,
      emit: (event) => events.push(event),
      flush: () => undefined,
      createId: () => `id-${(counter += 1)}`,
      now: () => new Date('2026-10-23T09:00:00.000Z'),
      writer: { id: 'unused', replaceRange: () => false, insertHtml: () => false },
      settle: () => Promise.resolve(),
    });
  });
  afterEach(() => {
    composers.clear(false);
    document.body.innerHTML = '';
  });

  it('adds a draft once, rebinds it to its conversation and removes it when the editor goes away', () => {
    const editor = addEditor('draft', 'Taslak metni');
    composers.sync([{ editor, isReply: true, threadKey: null }]);
    composers.sync([{ editor, isReply: true, threadKey: null }]);
    const [added] = composers.refs();
    expect(events.map((event) => event.type)).toEqual(['composer-added']);
    expect(added?.scope.providerId).toBe('test-mail');

    composers.sync([{ editor, isReply: true, threadKey: 'thread-1' }]);
    const rebound = events.at(-1);
    expect(rebound).toMatchObject({ type: 'composer-rebound', ref: { threadKey: 'thread-1' } });
    // The editor and its key stay the same, so work bound to it stays valid.
    expect(composers.refs()[0]?.composerKey).toBe(added?.composerKey);

    composers.sync([]);
    expect(events.at(-1)).toMatchObject({ type: 'composer-removed' });
    expect(composers.refs()).toEqual([]);
  });

  it('treats a draft that moves to another conversation as a new draft', () => {
    const editor = addEditor('draft', 'Taslak metni');
    composers.sync([{ editor, isReply: true, threadKey: 'thread-1' }]);
    composers.sync([{ editor, isReply: true, threadKey: 'thread-2' }]);
    expect(events.map((event) => event.type)).toEqual([
      'composer-added',
      'composer-removed',
      'composer-added',
    ]);
    expect(composers.refs()[0]?.threadKey).toBe('thread-2');
  });

  it("reads only the user's region and refuses an unknown or foreign draft", async () => {
    const editor = addEditor('draft', 'Yarın görüşelim');
    composers.sync([{ editor, isReply: false, threadKey: null }]);
    const [ref] = composers.refs();
    if (ref === undefined) throw new Error('no draft');

    const snapshot = await composers.readComposer(ref);
    expect(snapshot.ok && snapshot.value.editableText).toBe('Yarın görüşelim');
    expect(composers.contains(editor.firstChild!)).toBe(true);

    const unknown = await composers.readComposer({ ...ref, composerKey: 'missing' });
    const foreign = await composers.readComposer({
      ...ref,
      scope: { ...ref.scope, accountScopeId: 'other' },
    });
    expect(unknown).toMatchObject({ ok: false, error: { code: 'TARGET_MISSING' } });
    expect(foreign).toMatchObject({ ok: false, error: { code: 'TARGET_MISSING' } });
  });

  it('reports every draft as removed when cleared for an account switch', () => {
    composers.sync([
      { editor: addEditor('one', 'Bir'), isReply: false, threadKey: null },
      { editor: addEditor('two', 'İki'), isReply: false, threadKey: null },
    ]);
    events = [];
    composers.clear(true);
    expect(events.map((event) => event.type)).toEqual(['composer-removed', 'composer-removed']);
  });
});

describe('mail-dom helpers', () => {
  it('keeps the outermost or innermost of nested matches', () => {
    document.body.innerHTML = '<div id="outer"><div id="inner"></div></div><div id="alone"></div>';
    const all = Array.from(document.querySelectorAll('div'));
    expect(outermostElements(all).map((element) => element.id)).toEqual(['outer', 'alone']);
    expect(innermostElements(all).map((element) => element.id)).toEqual(['inner', 'alone']);
    document.body.innerHTML = '';
  });

  it('tells dark backgrounds from light ones', () => {
    expect(isDarkBackground('#202124')).toBe(true);
    expect(isDarkBackground('rgb(255, 255, 255)')).toBe(false);
    expect(isDarkBackground('transparent')).toBeNull();
  });
});
