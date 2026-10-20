/** Tags of the shadow roots the extension adds to the page. */
const OWN_UI_TAGS = 'writehand-launcher, writehand-panel';

/**
 * When the extension is updated or reinstalled, the old content script (especially
 * in Firefox) is stopped before it can clean up, leaving its toolbar and panel roots
 * orphaned and unresponsive. The new session removes them before adding its own UI.
 * Returns the number of roots removed.
 */
export function removeOrphanedUi(document: Document): number {
  const stale = [...document.querySelectorAll(OWN_UI_TAGS)];
  for (const element of stale) {
    element.remove();
  }
  return stale.length;
}
