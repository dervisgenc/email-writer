import { appError, err, ok, type AppError, type DraftSelection, type Result } from '@writehand/contracts';

import type { StoredRange } from '../observe-editor';
import type { ComposerHandle } from '../writing/composer-handle';
import type { SelectionRegistry } from './selection-registry';
import { offsetForPoint } from './text-range-map';

function liveSelectionIn(document: Document, editor: HTMLElement): StoredRange | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const startsInside = editor.contains(range.startContainer);
  const endsInside = editor.contains(range.endContainer);
  if (!startsInside && !endsInside) {
    return null;
  }
  return range;
}

function isBeforeBoundary(point: Node, boundary: Element | null): boolean {
  if (boundary === null) {
    return true;
  }
  if (boundary === point || boundary.contains(point)) {
    return false;
  }
  return (boundary.compareDocumentPosition(point) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

/**
 * Captures the selection in a draft. On a mouse press of the button it must be
 * called before focus is lost; with the keyboard, the last valid selection is
 * used. Both ends of the selection must be in the region the user wrote; a
 * selection that spills into the signature or quote is rejected.
 */
export function captureDraftSelection(
  document: Document,
  handle: ComposerHandle,
  registry: SelectionRegistry,
  createId: () => string,
): Result<DraftSelection | null, AppError> {
  const range = liveSelectionIn(document, handle.editor) ?? handle.tracker.lastSelection();
  if (range === null) {
    return ok(null);
  }
  const { editor } = handle;
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return err(appError('SELECTION_INVALID', { field: 'source' }));
  }

  const revision = handle.tracker.sync();
  const anatomy = handle.readAnatomy();
  if (
    !isBeforeBoundary(range.startContainer, anatomy.boundary) ||
    !isBeforeBoundary(range.endContainer, anatomy.boundary)
  ) {
    return err(appError('SELECTION_INVALID', { field: 'source' }));
  }

  const start = offsetForPoint(
    document,
    anatomy.editableSegments,
    { node: range.startContainer, offset: range.startOffset },
    'forward',
  );
  const end = offsetForPoint(
    document,
    anatomy.editableSegments,
    { node: range.endContainer, offset: range.endOffset },
    'backward',
  );
  if (end <= start) {
    return ok(null);
  }

  const selection: DraftSelection = {
    selectionId: createId(),
    composerRef: handle.ref,
    composerRevision: revision,
    start,
    end,
    text: anatomy.editableText.slice(start, end),
  };
  registry.register({
    selectionId: selection.selectionId,
    composerKey: handle.ref.composerKey,
    revision,
    start,
    end,
    text: selection.text,
  });
  return ok(selection);
}
