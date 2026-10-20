import type { ContextEdit, ContextSelection } from '@writehand/contracts';

/**
 * Adds or removes a message in the context panel. The selection is stored as exceptions
 * to the default rule; a message is never in both the included and the excluded list.
 */
export function withMessageInclusion(
  selection: ContextSelection,
  messageKey: string,
  included: boolean,
): ContextSelection {
  const without = (keys: readonly string[]) => keys.filter((key) => key !== messageKey);
  return included
    ? { included: [...without(selection.included), messageKey], excluded: without(selection.excluded) }
    : { included: without(selection.included), excluded: [...without(selection.excluded), messageKey] };
}

/**
 * Edits a message's text in the context; `null` removes the edit and restores the
 * original text. The original message and email are unchanged.
 */
export function withMessageEdit(
  edits: readonly ContextEdit[],
  messageKey: string,
  text: string | null,
): readonly ContextEdit[] {
  const others = edits.filter((edit) => edit.messageKey !== messageKey);
  return text === null ? others : [...others, { messageKey, text }];
}
