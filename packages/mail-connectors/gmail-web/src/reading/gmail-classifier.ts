import type { ElementRole } from '@writehand/mail-dom';

import { matches } from '../discovery/selectors';

/**
 * Classifies text regions by Gmail's markers: where earlier mail starts, the signature, the
 * collapsed "trimmed content" toggle and the extension's own UI. Words like "Regards" alone do
 * not count as a signature.
 */
export function createGmailClassifier(ownUiSelector: string): (element: Element) => ElementRole {
  return (element) => {
    if (element.matches(ownUiSelector) || matches(element, 'trimmedContentToggle')) {
      return 'exclude';
    }
    if (matches(element, 'quoteStart')) {
      return 'quote-start';
    }
    if (matches(element, 'signature')) {
      return 'signature';
    }
    return null;
  };
}
