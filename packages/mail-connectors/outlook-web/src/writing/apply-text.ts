import {
  appError,
  err,
  isSameScope,
  ok,
  type AppError,
  type ApplyOutcome,
  type ApplyRequest,
  type ApplyTarget,
  type ComposerRef,
  type ErrorCode,
  type MailScope,
  type Result,
} from '@email-writer/contracts';

import { editableRegionRange, emptyInsertionRange, type ComposerAnatomy } from '../reading/composer-anatomy';
import type { SelectionRegistry } from '../selection/selection-registry';
import { rangeForOffsets } from '../selection/text-range-map';
import { comparableText, isEditorWritable, type ComposerHandle } from './composer-handle';
import type { EditorWriter } from './editor-writer';
import type { UndoStore } from './undo-store';

export interface WriteDependencies {
  readonly document: Document;
  readonly scope: () => MailScope;
  readonly findComposer: (ref: ComposerRef) => ComposerHandle | null;
  readonly selections: SelectionRegistry;
  readonly undo: UndoStore;
  readonly writer: EditorWriter;
  readonly createId: () => string;
  /** Editörün bir sonraki normal yeniden çizimini bekler; sonuç tekrar doğrulanır. */
  readonly settle: () => Promise<void>;
  /** Uygulama kimliği → sonuç. Aynı kimlikle ikinci kez yazılmaz. */
  readonly attempts: Map<string, 'applied' | 'uncertain' | 'rejected'>;
}

interface WritePlan {
  readonly range: Range;
  readonly start: number;
  readonly end: number;
}

const RICH_SELECTOR = 'table, img, picture, svg, video, audio, iframe, object, embed, canvas';

function rejected(code: ErrorCode): ApplyOutcome {
  return { status: 'rejected', error: appError(code, { field: 'target' }) };
}

function crossesStructure(range: Range): boolean {
  if (range.cloneContents().querySelector(RICH_SELECTOR) !== null) {
    return true;
  }
  const cellOf = (node: Node) =>
    (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest('td, th') ?? null;
  return cellOf(range.startContainer) !== cellOf(range.endContainer);
}

function planWrite(
  target: ApplyTarget,
  anatomy: ComposerAnatomy,
  deps: WriteDependencies,
): Result<WritePlan, AppError> {
  switch (target.mode) {
    case 'replace-selection': {
      const record = deps.selections.get(target.selectionId);
      const isValid =
        record !== null &&
        record.composerKey === target.composerRef.composerKey &&
        record.revision === target.expectedRevision &&
        anatomy.editableText.slice(record.start, record.end) === record.text;
      if (!isValid) {
        // Aynı metni sayfanın başka yerinde aramak yasaktır; yeniden seçim istenir.
        return err(appError('SELECTION_INVALID', { field: 'target' }));
      }
      const range = rangeForOffsets(deps.document, anatomy.editableSegments, record.start, record.end);
      if (range === null) {
        return err(appError('SELECTION_INVALID', { field: 'target' }));
      }
      if (crossesStructure(range)) {
        return err(appError('WRITE_UNSUPPORTED', { field: 'target' }));
      }
      return ok({ range, start: record.start, end: record.end });
    }
    case 'replace-body':
      if (!anatomy.canReplaceBody) {
        return err(appError('WRITE_UNSUPPORTED', { field: 'target' }));
      }
      return ok({ range: editableRegionRange(anatomy), start: 0, end: anatomy.editableText.length });
    case 'insert-empty':
      if (!anatomy.canInsertIntoEmptyBody) {
        return err(appError('TARGET_CHANGED', { field: 'target' }));
      }
      return ok({ range: emptyInsertionRange(anatomy), start: 0, end: 0 });
  }
}

/**
 * Hedefi DOM'a yazmadan hemen önce tekrar doğrular, düz metni tek düzenleme
 * olarak yerleştirir ve editörü yeniden okuyarak sonucu kontrol eder. Son
 * kontrol ile yazma arasında bekleme veya ağ işlemi yoktur.
 */
export async function applyText(request: ApplyRequest, deps: WriteDependencies): Promise<ApplyOutcome> {
  const { target, text, applyOperationId } = request;

  const previous = deps.attempts.get(applyOperationId);
  if (previous === 'applied' || previous === 'uncertain') {
    return {
      status: 'rejected',
      error: appError(previous === 'uncertain' ? 'WRITE_UNCERTAIN' : 'TARGET_CHANGED'),
    };
  }
  if (text.trim().length === 0) {
    return { status: 'rejected', error: appError('RESULT_INVALID', { field: 'preview' }) };
  }
  if (!isSameScope(target.composerRef.scope, deps.scope())) {
    return rejected('TARGET_MISSING');
  }
  const handle = deps.findComposer(target.composerRef);
  if (handle === null || !isEditorWritable(handle.editor)) {
    return rejected('TARGET_MISSING');
  }
  // IME ile yazım sürüyorsa kullanıcı bu taslağı değiştiriyor demektir.
  if (handle.tracker.isComposing() || handle.tracker.sync() !== target.expectedRevision) {
    return rejected('TARGET_CHANGED');
  }

  const before = handle.readAnatomy();
  const plan = planWrite(target, before, deps);
  if (!plan.ok) {
    return { status: 'rejected', error: plan.error };
  }
  const { start, end } = plan.value;
  const prefix = before.editableText.slice(0, start);
  const suffix = before.editableText.slice(end);
  const expected = comparableText(prefix + text + suffix);

  // Yazmadan önce işaretlenir: beklenmeyen bir hata olsa bile otomatik tekrar yapılmaz.
  deps.attempts.set(applyOperationId, 'uncertain');
  let accepted: boolean;
  try {
    accepted = deps.writer.replaceRange(handle.editor, plan.value.range, text);
  } catch {
    accepted = false;
  }

  const verify = (): ComposerAnatomy | null => {
    const current = handle.readAnatomy();
    const isExpected =
      comparableText(current.editableText) === expected &&
      comparableText(current.protectedText) === comparableText(before.protectedText);
    return isExpected ? current : null;
  };

  let after = verify();
  if (after !== null) {
    await deps.settle();
    after = verify();
  }

  if (after === null) {
    const unchanged =
      comparableText(handle.readAnatomy().editableText) === comparableText(before.editableText);
    if (!accepted && unchanged) {
      deps.attempts.set(applyOperationId, 'rejected');
      return rejected('WRITE_UNSUPPORTED');
    }
    return { status: 'uncertain', error: appError('WRITE_UNCERTAIN') };
  }

  const revisionAfter = handle.tracker.sync();
  deps.selections.forgetComposer(target.composerRef.composerKey);
  deps.attempts.set(applyOperationId, 'applied');

  const boundariesIntact = after.editableText.startsWith(prefix) && after.editableText.endsWith(suffix);
  if (!boundariesIntact) {
    // Değişen bölüm kesin sınırlanamıyorsa geri alma sunulmaz.
    deps.undo.forgetComposer(target.composerRef.composerKey);
    return { status: 'applied', composerRevision: revisionAfter, undoId: null };
  }

  const undoId = deps.createId();
  deps.undo.save({
    undoId,
    applyOperationId,
    composerRef: target.composerRef,
    revisionAfter,
    start,
    insertedText: after.editableText.slice(start, after.editableText.length - suffix.length),
    previousText: before.editableText.slice(start, end),
    editableTextBefore: before.editableText,
    protectedText: before.protectedText,
  });
  return { status: 'applied', composerRevision: revisionAfter, undoId };
}
