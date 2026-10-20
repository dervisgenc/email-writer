import { appError, type UndoOutcome } from '@writehand/contracts';

import { rangeForOffsets } from '../selection/text-range-map';
import { comparableText, isEditorWritable, isProtectedIntact } from './composer-handle';
import { focusEditor, type WriteDependencies } from './apply-text';

function invalid(): UndoOutcome {
  return { status: 'rejected', error: appError('UNDO_INVALID') };
}

/**
 * Undoes only the extension's last verified write, and only while its
 * conditions still hold. Outlook's general undo history is never rewound
 * blindly; `execCommand('undo')` is not called. The previous text comes back as
 * plain text; formatting in that part is not restored.
 */
export async function undoChange(undoId: string, deps: WriteDependencies): Promise<UndoOutcome> {
  const pending = deps.undo.find(undoId);
  if (pending === null) {
    return invalid();
  }
  await focusEditor(pending.composerRef, deps);
  // Another call may have undone the same record while we were waiting.
  const record = deps.undo.find(undoId);
  if (record === null) {
    return invalid();
  }
  const handle = deps.findComposer(record.composerRef);
  if (handle === null || !isEditorWritable(handle.editor) || handle.tracker.isComposing()) {
    return invalid();
  }
  // If the user made another edit in between, automatic undo is no longer possible.
  if (handle.tracker.sync() !== record.revisionAfter) {
    return invalid();
  }

  const current = handle.readAnatomy();
  const insertedEnd = record.start + record.insertedText.length;
  const isIntact =
    current.editableText.slice(record.start, insertedEnd) === record.insertedText &&
    isProtectedIntact(record.protectedText, current.protectedText);
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
    isProtectedIntact(current.protectedText, after.protectedText);
  if (!restored) {
    return { status: 'uncertain', error: appError('WRITE_UNCERTAIN') };
  }
  deps.selections.forgetComposer(record.composerRef.composerKey);
  return { status: 'undone', composerRevision: handle.tracker.sync() };
}
