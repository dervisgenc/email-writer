/** An element the user can type in: `contenteditable="true"` and, in browsers, really editable. */
export function isEditableElement(element: HTMLElement): boolean {
  if (element.getAttribute('contenteditable') !== 'true') {
    return false;
  }
  // The test DOM does not implement `isContentEditable`; browsers get the extra check.
  return element.isContentEditable !== false;
}

/** Visible on screen; environments without `checkVisibility` (the test DOM) count it as visible. */
export function isVisibleElement(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

/** Keeps only the outermost elements: a match nested inside another match is dropped. */
export function outermostElements<T extends Element>(elements: readonly T[]): T[] {
  return elements.filter(
    (element) => !elements.some((other) => other !== element && other.contains(element)),
  );
}

/** Keeps only the innermost elements: a match that contains another match is dropped. */
export function innermostElements<T extends Element>(elements: readonly T[]): T[] {
  return elements.filter(
    (element) => !elements.some((other) => other !== element && element.contains(other)),
  );
}
