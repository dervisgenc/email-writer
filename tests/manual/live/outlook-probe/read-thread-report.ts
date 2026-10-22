import { createOutlookWebConnector, OUTLOOK_SELECTORS } from '@writehand/outlook-web';

import { OWN_UI_SELECTOR } from '../../../../apps/browser-extension/src/bootstrap/mail-provider';
import { readThreadReport, type ThreadReport } from '../probe/thread-report';

/** Reads the open Outlook conversation with the extension's connector and masks the result. */
export function readOutlookThreadReport(document: Document): Promise<ThreadReport> {
  return readThreadReport(document, {
    connect: () => createOutlookWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR }),
    bodySelector: OUTLOOK_SELECTORS.messageBody.selectors.join(', '),
  });
}
