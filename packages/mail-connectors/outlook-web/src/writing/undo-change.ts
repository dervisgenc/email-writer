import { appError, type UndoOutcome } from '@email-writer/contracts';

import { rangeForOffsets } from '../selection/text-range-map';
import { comparableText, isEditorWritable } from './composer-handle';
import type { WriteDependencies } from './apply-text';

function invalid(): UndoOutcome {
  return { status: 'rejected', error: appError('UNDO_INVALID') };
}

/**
 * Yalnızca eklentinin son doğrulanmış yazmasını, koşulları hâlâ geçerliyse
 * geri alır. Outlook'un genel geri alma geçmişi kontrolsüz biçimde geri
 * sarılmaz; `execCommand('undo')` çağrılmaz. Önceki metin düz metin olarak
 * geri gelir; o bölümdeki biçimlendirme geri getirilmez.
 */
export async function undoChange(undoId: string, deps: WriteDependencies): Promise<UndoOutcome> {
  const record = deps.undo.find(undoId);
  if (record === null) {
    return invalid();
  }
  const handle = deps.findComposer(record.composerRef);
  if (handle === null || !isEditorWritable(handle.editor) || handle.tracker.isComposing()) {
    return invalid();
  }
  // Kullanıcı araya yeni bir düzenleme eklediyse otomatik geri alma kapanır.
  if (handle.tracker.sync() !== record.revisionAfter) {
    return invalid();
  }

  const current = handle.readAnatomy();
  const insertedEnd = record.start + record.insertedText.length;
  const isIntact =
    current.editableText.slice(record.start, insertedEnd) === record.insertedText &&
    comparableText(current.protectedText) === comparableText(record.protectedText);
  const range = isIntact
    ? rangeForOffsets(deps.document, current.editableSegments, record.start, insertedEnd)
    : null;
  if (range === null) {
    return invalid();
  }

  deps.undo.remove(undoId);
  try {
    deps.writer.replaceRange(handle.editor, range, record.previousText);
  } catch {
    return { status: 'uncertain', error: appError('WRITE_UNCERTAIN') };
  }
  await deps.settle();

  const after = handle.readAnatomy();
  const restored =
    comparableText(after.editableText) === comparableText(record.editableTextBefore) &&
    comparableText(after.protectedText) === comparableText(record.protectedText);
  if (!restored) {
    return { status: 'uncertain', error: appError('WRITE_UNCERTAIN') };
  }
  deps.selections.forgetComposer(record.composerRef.composerKey);
  return { status: 'undone', composerRevision: handle.tracker.sync() };
}
