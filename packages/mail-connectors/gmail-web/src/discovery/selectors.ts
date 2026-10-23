/**
 * The single home of ALL Gmail-specific selectors. Selectors appear neither in UI components
 * nor in shared business logic.
 *
 * STATUS: the selectors were collected on 2026-10-23 from the code of open-source projects that
 * target Gmail's DOM, read at their latest commits: InboxSDK (`selectors.ts`,
 * `gmail-element-getter.ts`, the compose and thread views), gmail.js, FlowCrypt
 * (`gmail-element-replacer.ts`), Mailvelope, cmux's Gmail driver and smaller extensions. The
 * sources, with links, are listed in docs/DEVELOPMENT.md (Gmail selectors). Those that matched
 * on a real Gmail account (`pnpm gmail:inspect`) are `verified` with a `verifiedOn` record; the
 * synthetic page in `tests/fixtures/gmail/` follows the structure seen there. The rest are
 * still candidates.
 *
 * Rules:
 * - Gmail's class names are generated and short (`hP`, `adn`, `a3s`). Every source relies on
 *   them, but attributes (`role`, `name`, `g_editable`, `data-*`) and the `gmail_*` classes that
 *   are part of the mail HTML itself are stronger anchors and come first where they exist.
 * - UI-language-dependent text (`aria-label="Message Body"`, "Show trimmed content") is never
 *   used.
 * - `contenteditable` alone does not mean an email editor.
 */
import {
  selectorQueries,
  type EvidenceLevel,
  type SelectorDefinition as GenericSelectorDefinition,
} from '@writehand/mail-dom';

export type { SelectorStatus } from '@writehand/mail-dom';

export interface VerificationRecord {
  readonly accountType: 'personal' | 'workspace';
  readonly uiLanguage: string;
  readonly browser: string;
  /** `unknown` when the check did not establish the setting. */
  readonly conversationView: 'on' | 'off' | 'unknown';
  /** Gmail's reading pane setting: no split, right of the inbox or below it. */
  readonly readingPane: 'no-split' | 'right' | 'below';
  /** Reading selectors are verified with no editor open (`null`). */
  readonly editor: 'inline-reply' | 'compose-window' | 'full-screen' | null;
  readonly date: string;
}

export type SelectorDefinition = GenericSelectorDefinition<VerificationRecord>;

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

/** Personal account, English interface, a single-message conversation open without a split pane. */
const PERSONAL_EN_FIREFOX_READING: VerificationRecord = {
  accountType: 'personal',
  uiLanguage: 'en',
  browser: 'Firefox 158 (macOS)',
  conversationView: 'unknown',
  readingPane: 'no-split',
  editor: null,
  date: '2026-10-23',
};

/** The same account with a new message open in a compose window. */
const PERSONAL_EN_FIREFOX_COMPOSE: VerificationRecord = {
  ...PERSONAL_EN_FIREFOX_READING,
  editor: 'compose-window',
};

/**
 * Attributes on the subject heading that carry Gmail's conversation id, in order of preference.
 * `data-thread-perm-id` (`thread-f:…`) may hold the string "undefined" (InboxSDK).
 */
export const THREAD_ID_ATTRIBUTES = ['data-legacy-thread-id', 'data-thread-perm-id'] as const;

/**
 * Attributes on the message container that carry Gmail's message id. `data-message-id`
 * (`#msg-f:…`) comes first: `data-legacy-message-id` is missing on a reply just sent until Gmail
 * syncs it (InboxSDK), and the key must not change in between.
 */
export const MESSAGE_ID_ATTRIBUTES = ['data-message-id', 'data-legacy-message-id'] as const;

/** Values Gmail writes into id attributes and hidden inputs before an id exists. */
export const MISSING_ID_VALUES: readonly string[] = ['', 'undefined', 'null'];

/**
 * Hidden inputs of a draft's form that name what it replies to. Seen on the real page in a reply
 * opened from the message list: `lts` holds the conversation's legacy id (the same value as the
 * list row's and the subject's `data-legacy-thread-id`), `rt` its permanent id (`#thread-f:…`)
 * and `rm` the replied-to message's id (`#msg-f:…`, the same form as `data-message-id`).
 */
export const REPLY_FORM_INPUTS = { legacyThreadId: 'lts', threadId: 'rt', repliedMessageId: 'rm' } as const;

export const GMAIL_SELECTORS = {
  /**
   * The mail app's main area. Gmail sets `role="main"` only once the app has loaded; `.aeF > .nH`
   * exists on routes without it.
   */
  mainArea: verified(
    ['div[role="main"]', 'div.aeF > div.nH'],
    'high',
    'InboxSDK selectors.ts and the route view; gmail.js; cmux. Both matched on the inbox and in a conversation.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /** Subject heading of the open conversation; it carries the conversation id attributes. */
  threadSubject: verified(
    ['h2[data-legacy-thread-id]', 'h2[data-thread-perm-id]', 'h2.hP', '.ha h2'],
    'high',
    'gmail.js and cmux read `h2.hP`, InboxSDK `.ha h2`; gmail.js and copy-as-markdown find the ids on the h2. All four matched the same heading, which carries both id attributes.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /**
   * The full-width row of the subject; the conversation's button sits at its end. The heading's
   * own container (`.ha`) is only as wide as the subject.
   */
  subjectRow: verified(
    ['.V8djrc.byY'],
    'medium',
    'Seen on the real page: `div.nH.V8djrc.byY > div > div.ha > h2.hP`, as wide as the conversation.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /** Gmail's icon buttons at the end of the subject row (print all, open in a new window). */
  subjectRowActions: verified(
    ['button.bHI'],
    'medium',
    'Two 40 px icon buttons at the right end of the subject row on the real page; InboxSDK names that area `.bHJ`.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /**
   * The open conversation: subject, messages and inline reply. In split-pane mode the same area
   * also holds the message list, whose rows have no message body.
   */
  threadView: verified(
    ['div[role="main"]'],
    'medium',
    'cmux takes the `role="main"` area that contains `h2.hP`. InboxSDK finds the container itself (`.a98.iY` since the November 2023 redesign), FlowCrypt `div.if, div.aHU, td.Bu` with `.a98.iY` as the fallback. On the real page the chain is `role="main" > .nH.g.id > .nH.a98.iY`, holding the subject row and the messages.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /** One expanded message; it carries both message ids. */
  message: verified(
    ['div.adn[data-message-id]', 'div.adn[data-legacy-message-id]', 'div.adn.ads', 'div.adn'],
    'high',
    'gmail.js, InboxSDK and Mailvelope read the ids from `div.adn.ads`; all four matched the expanded message.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /** Body of an expanded message. For nested matches the innermost is kept. */
  messageBody: verified(
    ['div.a3s'],
    'high',
    '`div.a3s` inside `div.ii.gt` (InboxSDK, gmail.js, cmux). Its second class differs between sources (`aiL`, `aXjCH`), so `.a3s` stands alone. The connector read all of its visible text.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /**
   * A collapsed message (`.kv`, `.ky`) or one hidden in the "N older messages" group (`.kQ`,
   * `.kx`); their bodies are not on the page.
   */
  collapsedMessage: candidate(
    ['.kv', '.ky', '.kQ', '.kx'],
    'medium',
    'InboxSDK gmail-message-view.ts maps the message list children: `.h7` expanded, `.kv`/`.ky` collapsed, `.kQ`/`.kx` hidden. Without a match the count stays unknown.',
  ),

  /** Sender of a message, with `name` and `email` attributes. Only the name is used. */
  messageSender: verified(
    ['span.gD[email]', 'td.gF span[email]', 'span.gD'],
    'high',
    'gmail.js and cmux use `span.gD`, InboxSDK `td.gF span[email]`; all three matched, and the `name` attribute gave the display name.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /** Displayed date of a message; its `title` holds the full, locale-formatted date. */
  messageDate: verified(
    ['span.g3[title]', '.gK .g3', 'span.g3'],
    'high',
    'InboxSDK `.ads .gK .g3`, gmail.js and cmux; all read the `title`, not the text. All three matched; the title holds the full date.',
    [PERSONAL_EN_FIREFOX_READING],
  ),

  /**
   * Where earlier mail starts inside a message or editor: Gmail's own markers, which are part
   * of the mail HTML, then those of other mail clients whose messages Gmail shows.
   */
  quoteStart: verified(
    [
      '.gmail_quote_container',
      '.gmail_quote',
      'blockquote.gmail_quote',
      '[id$="divRplyFwdMsg"]',
      '[id$="appendonsend"]',
      'blockquote[type="cite"]',
      '.moz-cite-prefix',
      '.yahoo_quoted',
    ],
    'high',
    '`div.gmail_quote > div.gmail_attr + blockquote.gmail_quote` in InboxSDK test data and FlowCrypt; Google’s Workspace CLI writes the outer `.gmail_quote_container`. On the real page the loaded quote of a reply was `div.gmail_quote.gmail_quote_container > div.gmail_attr + blockquote.gmail_quote`; the other clients’ markers are still candidates.',
    [PERSONAL_EN_FIREFOX_COMPOSE],
  ),

  /** Signature block in a message or editor; `.gmail_signature_prefix` is its "-- " line. */
  signature: candidate(
    ['.gmail_signature_prefix', '[data-smartmail="gmail_signature"]', '.gmail_signature'],
    'high',
    'cmux strips exactly these to read the user’s text; InboxSDK test data has `div.gmail_signature[data-smartmail]`.',
  ),

  /**
   * The "Show trimmed content" toggle (three dots) that hides quoted text in a message or a
   * reply draft; its own content is not message text.
   */
  trimmedContentToggle: verified(
    ['.ajR', '.yj6qo'],
    'medium',
    'InboxSDK and better-gmail click `.ajR` to show a reply’s quote; copy-as-markdown also skips `.yj6qo`. On the real page `.yj6qo` sat in a received message, and `.ajR` in a reply opened from the message list, outside its editor: the quote was not in the page until `.ajR` was clicked, and a plain `click()` loaded it.',
    [PERSONAL_EN_FIREFOX_READING, PERSONAL_EN_FIREFOX_COMPOSE],
  ),

  /** Draft editor: the compose body. */
  composeEditor: verified(
    [
      'div[g_editable="true"][contenteditable="true"]',
      'div[role="textbox"][g_editable="true"]',
      'div.Am.Al.editable[contenteditable="true"]',
    ],
    'high',
    'InboxSDK `.Ap [g_editable=true]`, cmux `div[role=textbox][g_editable="true"]`, Mailvelope `.Am.Al`. `aria-label="Message Body"` is translated and not used. All three matched the editor of a compose window.',
    [PERSONAL_EN_FIREFOX_COMPOSE],
  ),

  /**
   * Container of one draft: an inline reply, a compose window or the full-screen compose. Its
   * hidden inputs and reply markers are looked up inside it.
   */
  composeContainer: verified(
    ['div.M9', 'td.I5', 'div.aaZ', 'div[role="dialog"]', 'div.AD'],
    'medium',
    'InboxSDK and gmail.js use `.M9` and `div.AD`, FlowCrypt `div.gA td.I5` and `.aaZ`; compose windows are dialogs. All five matched around a compose window, so `.M9` is the compose root in general; inline replies are not checked yet.',
    [PERSONAL_EN_FIREFOX_COMPOSE],
  ),

  /** Reply markers inside a draft's container, besides a non-empty `input[name="rm"]`. */
  replyMarker: candidate(
    ['.HQ', 'table.aoP img.ajn'],
    'low',
    'InboxSDK: `.HQ` marks a reply; FlowCrypt: only replies show the avatar `img.ajn` in `table.aoP`.',
  ),

  /** Ancestor regions of editable fields known not to be the draft editor. */
  composeExclusions: candidate(
    ['[role="search"]', '[role="combobox"]', '.a3s', '.gmail_quote'],
    'medium',
    'Search and recipient fields; cmux also skips editables inside a message body or a quote.',
  ),

  /** The surface whose computed background tells the theme. */
  themeSurface: verified(
    ['.bkK > .nH', 'div[role="main"]'],
    'medium',
    'InboxSDK track-gmail-styles.ts: the body is dark when the background of `.bkK > .nH` is dark. The default light theme read as light; a dark theme is not checked yet.',
    [PERSONAL_EN_FIREFOX_READING],
  ),
} as const satisfies Record<string, SelectorDefinition>;

export type SelectorKey = keyof typeof GMAIL_SELECTORS;

const queries = selectorQueries<SelectorKey>(GMAIL_SELECTORS);

export const SELECTOR_KEYS = queries.keys;

export const { queryFirst, queryFirstOutside, queryAll, matches, closest } = queries;
