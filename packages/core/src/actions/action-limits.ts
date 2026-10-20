/**
 * Action validation limits (in UTF-16 code units). Not a token count; defined in one
 * place only.
 */
export const ACTION_LIMITS = Object.freeze({
  /** Source for revision or translation. */
  maxSourceLength: 20_000,
  /** Reply instruction. */
  maxInstructionLength: 5_000,
  /** Text accepted into the preview. */
  maxPreviewLength: 30_000,
});
