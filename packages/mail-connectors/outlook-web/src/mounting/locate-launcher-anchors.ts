import type { ComposerRef, ThreadRef } from '@email-writer/contracts';

/**
 * Eklentinin montaj koduna verilen düğme konumları. Bu dar arayüzde
 * `HTMLElement` kullanılabilir; bu nesneler `core`, işlem kayıtları veya
 * depolamaya geçirilmez.
 */
export interface OutlookLauncherAnchor {
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
 * Konuşma bölmesinin üst köşesi ve her taslak editörünün alt köşesi.
 * Konumlar gerçek Outlook arayüzünde doğrulanana kadar adaydır.
 */
export function locateLauncherAnchors(sources: AnchorSources): OutlookLauncherAnchor[] {
  const anchors: OutlookLauncherAnchor[] = [];
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
      key: `composer:${composer.ref.composerKey}`,
      element: composer.editor,
      placement: 'bottom-end',
      target: { kind: 'composer', composer: composer.ref },
    });
  }
  return anchors;
}
