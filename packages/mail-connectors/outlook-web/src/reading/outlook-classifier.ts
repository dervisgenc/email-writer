import type { ElementRole } from '@writehand/mail-dom';

import { matches } from '../discovery/selectors';

/**
 * Classifies text regions by Outlook markers: where earlier mail starts, the
 * signature and the extension's own UI. Words like "Regards" or "Thanks" alone
 * do not count as a signature.
 */
export function createOutlookClassifier(ownUiSelector: string): (element: Element) => ElementRole {
  return (element) => {
    if (element.matches(ownUiSelector)) {
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
