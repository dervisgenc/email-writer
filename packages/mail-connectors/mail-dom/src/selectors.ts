/**
 * The shape of a connector's selector registry. Each mail service keeps every selector it uses
 * in one file (`selectors.ts`) with the evidence behind it; these helpers query the DOM with
 * such a registry, so selectors never appear anywhere else.
 */

export type SelectorStatus = 'candidate' | 'verified';
export type EvidenceLevel = 'high' | 'medium' | 'low';

export interface SelectorDefinition<VerificationRecord = unknown> {
  /** Tried in order; the first match wins. */
  readonly selectors: readonly string[];
  /** `verified` only after a check on the real mail service, recorded in `verifiedOn`. */
  readonly status: SelectorStatus;
  /** Strength of the evidence from public sources (not a substitute for verification). */
  readonly evidence: EvidenceLevel;
  readonly languageDependent: boolean;
  readonly note: string;
  readonly verifiedOn: readonly VerificationRecord[];
}

export interface SelectorQueries<Key extends string> {
  readonly keys: readonly Key[];
  /** All selectors of a key as one selector list. */
  list(key: Key): string;
  /** The first element matched by the first matching selector. */
  queryFirst(root: ParentNode, key: Key): HTMLElement | null;
  /** The first element outside `excluded`, trying the selectors in order. */
  queryFirstOutside(root: ParentNode, excluded: Node, key: Key): HTMLElement | null;
  /** The matches of all selectors in document order, without duplicates. */
  queryAll(root: ParentNode, key: Key): HTMLElement[];
  matches(element: Element, key: Key): boolean;
  closest(element: Element, key: Key): HTMLElement | null;
}

export function selectorQueries<Key extends string>(
  definitions: Readonly<Record<Key, SelectorDefinition>>,
): SelectorQueries<Key> {
  const selectorsOf = (key: Key) => definitions[key].selectors;
  const list = (key: Key) => selectorsOf(key).join(', ');
  return {
    keys: Object.keys(definitions) as Key[],
    list,
    queryFirst(root, key) {
      for (const selector of selectorsOf(key)) {
        const found = root.querySelector<HTMLElement>(selector);
        if (found !== null) {
          return found;
        }
      }
      return null;
    },
    queryFirstOutside(root, excluded, key) {
      for (const selector of selectorsOf(key)) {
        for (const found of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
          if (!excluded.contains(found)) {
            return found;
          }
        }
      }
      return null;
    },
    queryAll: (root, key) => Array.from(root.querySelectorAll<HTMLElement>(list(key))),
    matches: (element, key) => selectorsOf(key).some((selector) => element.matches(selector)),
    closest(element, key) {
      for (const selector of selectorsOf(key)) {
        const found = element.closest<HTMLElement>(selector);
        if (found !== null) {
          return found;
        }
      }
      return null;
    },
  };
}
