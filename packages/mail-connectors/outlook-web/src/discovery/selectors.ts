/**
 * The single home of ALL Outlook Web-specific selectors. Selectors appear
 * neither in UI components nor in shared business logic.
 *
 * STATUS: Candidates were collected from open-source extensions, user scripts
 * and real Outlook DOM fragments in public `.eml` samples (October 2026).
 * Selectors confirmed on a real account are `verified` and carry a
 * `verifiedOn` record, next to the anonymized page sample and test that
 * confirm them (`tests/fixtures/outlook/`, docs/DEVELOPMENT.md). When a
 * definition has several selectors, `note` says which one was verified.
 *
 * Rules:
 * - Generated (obfuscated) CSS classes (e.g. `GNqVo`, `rps_xxxx`) are never the sole anchor.
 * - UI-language-dependent `aria-label` text is never the sole anchor; when
 *   unavoidable, it is marked with `languageDependent: true`.
 * - `role="textbox"` alone does not mean an email editor.
 */

export type SelectorStatus = 'candidate' | 'verified';
export type EvidenceLevel = 'high' | 'medium' | 'low';

export interface VerificationRecord {
  readonly accountType: 'work' | 'personal';
  readonly uiLanguage: string;
  readonly browser: string;
  readonly conversationView: 'on' | 'off';
  /** Whether the reading pane shows every message of the conversation or only the selected one. */
  readonly readingPane: 'conversation' | 'selected-message';
  /** Reading selectors are verified with no editor open (`null`). */
  readonly editor: 'inline-reply' | 'popout' | 'new-message' | null;
  readonly date: string;
}

export interface SelectorDefinition {
  /** Tried in order; the first match wins. */
  readonly selectors: readonly string[];
  readonly status: SelectorStatus;
  /** Strength of the evidence from public sources (not a substitute for verification). */
  readonly evidence: EvidenceLevel;
  readonly languageDependent: boolean;
  readonly note: string;
  readonly verifiedOn: readonly VerificationRecord[];
}

function candidate(
  selectors: readonly string[],
  evidence: EvidenceLevel,
  note: string,
  languageDependent = false,
): SelectorDefinition {
  return { selectors, status: 'candidate', evidence, languageDependent, note, verifiedOn: [] };
}

function verified(
  selectors: readonly string[],
  evidence: EvidenceLevel,
  note: string,
  verifiedOn: readonly VerificationRecord[],
  languageDependent = false,
): SelectorDefinition {
  return { selectors, status: 'verified', evidence, languageDependent, note, verifiedOn };
}

/** Work account, English UI, conversation view on, only the selected message in the reading pane. */
const WORK_EN_FIREFOX_SELECTED_MESSAGE: VerificationRecord = {
  accountType: 'work',
  uiLanguage: 'en',
  browser: 'Firefox 157 (macOS)',
  conversationView: 'on',
  readingPane: 'selected-message',
  editor: null,
  date: '2026-10-15',
};

/**
 * Outlook gives the header parts of a message being read the id
 * `MSG_<item id>_<PART>` (e.g. `MSG_…_FROM`, `MSG_…_DATETIME`). The shared item
 * id ties a message's header to its body within the same container.
 */
export const MESSAGE_HEADER_PART_ID = /^MSG_(.+)_(?:FROM|TO|CC|BCC|SUBJECT|DATETIME)$/;

/**
 * The reading pane's subject heading has the id `CONV_<conversation token>_SUBJECT`.
 * The token is stable for a conversation and unaffected by scrolling the message
 * list (the virtual list removes an off-screen selected row from the DOM).
 */
export const CONVERSATION_SUBJECT_ID = /^CONV_(.+)_SUBJECT$/;

export const OUTLOOK_SELECTORS = {
  /** Reading pane; it has different ids in conversation view and single-message view. */
  readingPane: verified(
    ['#ReadingPaneContainerId', '#ConversationReadingPaneContainer', '#ItemReadingPaneContainer'],
    'high',
    '#ReadingPaneContainerId verified; in the selected-message view it contains #ItemReadingPaneContainer.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Selected row in the message list; `data-convid` or the row id identifies the conversation. */
  selectedConversation: verified(
    [
      '[role="option"][aria-selected="true"][data-convid]',
      'div[data-focusable-row="true"][aria-selected="true"]',
    ],
    'medium',
    'First selector verified (the row also has data-focusable-row). May be missing for a while after a folder change; absent in search results. The URL id is the fallback.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Body of each expanded message in the conversation. For nested matches the innermost is kept. */
  messageBody: verified(
    ['[id^="UniqueMessageBody"]', 'div[role="document"]'],
    'medium',
    '`div#UniqueMessageBody_N[role="document"]` verified; inside `[data-test-id="mailMessageBodyContainer"]`.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * Parts of the message header (`MSG_<item id>_FROM` etc.). The message container
   * is derived from them: the smallest ancestor that contains the body and carries
   * the header of a single item id. Generated classes and roles are not relied on.
   */
  messageHeaderPart: verified(
    ['[id^="MSG_"]'],
    'medium',
    'The SUBJECT, FROM, TO, CC and DATETIME parts carry the same item id.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Collapsed message row (body not loaded). NO EVIDENCE FOUND. */
  collapsedMessage: candidate(
    ['[role="listitem"][aria-expanded="false"]'],
    'low',
    'Without a match, the collapsed message count is not made up (null).',
  ),

  /**
   * Sender in the message header. The visible text may be `Name <address>`; only
   * the display name is used and the address is not stored. Fallbacks like
   * `title*="@"` are avoided because they catch recipients or quoted addresses.
   */
  messageSender: verified(['[id^="MSG_"][id$="_FROM"]'], 'medium', 'Has role="heading".', [
    WORK_EN_FIREFOX_SELECTED_MESSAGE,
  ]),

  /**
   * Person cards in the sender header. "X on behalf of Y" shows two cards: the
   * sending account (Sender) and the message's author (From). The author is the
   * last card; the connecting text in between is language-dependent and unused.
   */
  senderPersona: verified(
    ['[data-lpc-hover-target-id]', '[role="button"][aria-haspopup="dialog"]'],
    'medium',
    'Both point to the same person card element; two cards verified on an "on behalf of" message.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * Displayed sent time (e.g. "Wed 15-Oct-26 9:12 AM"). There is no
   * machine-readable date; language- and locale-dependent text is not parsed, so
   * `sentAt` stays empty.
   */
  messageDate: verified(
    ['[data-testid="SentReceivedSavedTime"]', '[id^="MSG_"][id$="_DATETIME"]'],
    'medium',
    'Both point to the same element.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * Conversation subject; for display only, never used as a key. The sender,
   * recipients and date in the reading pane also have `role="heading"`, so the
   * generic `[role="heading"]` selector is not used.
   */
  subject: verified(['[role="heading"][id^="CONV_"][id$="_SUBJECT"]'], 'medium', 'Has text and a title.', [
    WORK_EN_FIREFOX_SELECTED_MESSAGE,
  ]),

  /**
   * Where earlier mail starts inside a message or editor. When displaying mail,
   * Outlook prefixes ids in the email HTML with `x_` (`x_x_` inside a quote), so
   * suffix matching is used.
   */
  quoteStart: verified(
    [
      '[id$="divRplyFwdMsg"]',
      '[id$="appendonsend"]',
      '[id*="OLK_SRC_BODY_SECTION"]',
      '[class*="mail-editor-reference-message-container"]',
      '.gmail_quote',
      '.x_gmail_quote',
      'blockquote[type="cite"]',
      '.moz-cite-prefix',
      '.x_moz-cite-prefix',
      '.yahoo_quoted',
      '.x_yahoo_quoted',
    ],
    'high',
    'Outlook reply structure: #Signature → #appendonsend → hr → #divRplyFwdMsg. [id$="divRplyFwdMsg"] and [id$="appendonsend"] verified on a received message; the rest are candidates.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Signature block. Words like "Thanks" alone do not count as a signature. */
  signature: candidate(
    [
      '#Signature',
      '[id$="x_Signature"]',
      '[id$="ms-outlook-mobile-signature"]',
      '.ms-outlook-signature',
      '.gmail_signature',
      '.x_gmail_signature',
    ],
    'high',
    '#Signature usually comes with the `elementToProof` class.',
  ),

  /** Draft editor (RoosterJS-based `contenteditable`). */
  composeEditor: candidate(
    [
      'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
      'div[contenteditable="true"][aria-multiline="true"]',
    ],
    'high',
    'Reported to be the only multi-line text box on the page (Briskine, scrum_helper).',
  ),

  /** Region of the reply draft embedded in the reading pane. */
  inlineReplyRegion: candidate(['[id^="docking_InitVisiblePart"]'], 'medium', 'Briskine.'),

  /** Ancestor regions of editable fields known not to be the editor. */
  composeExclusions: candidate(
    [
      '[role="search"]',
      '#topSearchInput',
      '[role="combobox"]',
      '[id^="MSG_"][id$="_TO"]',
      '[id^="MSG_"][id$="_CC"]',
      '[id^="MSG_"][id$="_BCC"]',
      '[id^="MSG_"][id$="_SUBJECT"]',
    ],
    'medium',
    'Search, recipient and subject fields.',
  ),

  /**
   * Fluent UI v9 provider: Outlook's theme colors are defined on this element as
   * CSS variables (`--colorNeutralBackground1` etc.). The extension UI uses them
   * to match the Outlook theme.
   */
  themeProvider: verified(
    ['.fui-FluentProvider'],
    'high',
    'Color variables (--colorNeutralBackground1, --colorBrandBackground etc.) read on the live page.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Account hint: read only to derive a local, opaque account scope. */
  accountHint: verified(
    [
      '#owa-me-control-container button[aria-label]',
      '#O365_MainLink_Me',
      '#O365_UniversalMeContainer',
      '#mectrl_main_trigger',
    ],
    'medium',
    'First selector verified. The accessible name is hashed; the raw value is not stored.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
    true,
  ),
} as const satisfies Record<string, SelectorDefinition>;

export type SelectorKey = keyof typeof OUTLOOK_SELECTORS;

export const SELECTOR_KEYS = Object.keys(OUTLOOK_SELECTORS) as readonly SelectorKey[];

/** Non-mail Outlook modules: no button is added on these paths. */
export const NON_MAIL_PATH_PREFIXES = ['/calendar', '/people', '/files', '/tasks', '/bookings', '/todo'];

/** Item id in the URL: `/mail/<folder>/id/<id>`, `/deeplink/read/<id>`, `/deeplink/readconv/<id>`. */
export const URL_ITEM_ID = /\/(?:id|read|readconv)\/([^/?#]+)/;

export function selectorList(key: SelectorKey): string {
  return OUTLOOK_SELECTORS[key].selectors.join(', ');
}

/** Returns the first element matched by the first matching selector. */
export function queryFirst(root: ParentNode, key: SelectorKey): HTMLElement | null {
  for (const selector of OUTLOOK_SELECTORS[key].selectors) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/**
 * Returns the first element outside `excluded`, trying the selectors in order.
 * This keeps look-alike markers in the email body out of a message header lookup.
 */
export function queryFirstOutside(root: ParentNode, excluded: Node, key: SelectorKey): HTMLElement | null {
  for (const selector of OUTLOOK_SELECTORS[key].selectors) {
    for (const found of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      if (!excluded.contains(found)) {
        return found;
      }
    }
  }
  return null;
}

/** Returns the matches of all selectors in document order, without duplicates. */
export function queryAll(root: ParentNode, key: SelectorKey): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selectorList(key)));
}

export function matches(element: Element, key: SelectorKey): boolean {
  return OUTLOOK_SELECTORS[key].selectors.some((selector) => element.matches(selector));
}

export function closest(element: Element, key: SelectorKey): HTMLElement | null {
  for (const selector of OUTLOOK_SELECTORS[key].selectors) {
    const found = element.closest<HTMLElement>(selector);
    if (found !== null) {
      return found;
    }
  }
  return null;
}
