import type { ComposerRef, ThreadRef } from '@writehand/contracts';

/**
 * Button positions handed to the extension's mounting code. This narrow
 * interface may use `HTMLElement`; these objects never reach `core`, operation
 * records or storage.
 */
export interface MailLauncherAnchor {
  readonly key: string;
  readonly element: HTMLElement;
  readonly placement: 'top-end' | 'bottom-end';
  readonly target:
    | { readonly kind: 'thread'; readonly thread: ThreadRef }
    | { readonly kind: 'composer'; readonly composer: ComposerRef };
}

export interface AnchorSources {
  readonly thread: { readonly ref: ThreadRef; readonly root: HTMLElement } | null;
  readonly composers: readonly { readonly ref: ComposerRef; readonly editor: HTMLElement }[];
}

/**
 * The top corner of the conversation area and the bottom corner of each draft
 * editor. Each connector decides which elements these are; the positions are
 * candidates until verified in the real mail UI.
 */
export function locateLauncherAnchors(sources: AnchorSources): MailLauncherAnchor[] {
  const anchors: MailLauncherAnchor[] = [];
  if (sources.thread !== null) {
    anchors.push({
      key: `thread:${sources.thread.ref.threadKey}`,
      element: sources.thread.root,
      placement: 'top-end',
      target: { kind: 'thread', thread: sources.thread.ref },
    });
  }
  for (const composer of sources.composers) {
    anchors.push({
      // The key leaves out the thread binding: if the draft is later bound to a reply, the
      // toolbar and its card are not rebuilt (the button the user is pressing does not vanish).
      key: `composer:${composer.ref.composerKey}`,
      element: composer.editor,
      placement: 'bottom-end',
      target: { kind: 'composer', composer: composer.ref },
    });
  }
  return anchors;
}
