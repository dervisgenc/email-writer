/**
 * The single home of ALL Gmail-specific selectors. Selectors appear neither in UI components
 * nor in shared business logic.
 *
 * STATUS: every selector is a `candidate`. They were collected on 2026-10-23 from the code of
 * open-source projects that target Gmail's DOM and were read at their latest commits:
 * InboxSDK (`selectors.ts`, `gmail-element-getter.ts`, the compose and thread views), gmail.js,
 * FlowCrypt (`gmail-element-replacer.ts`), Mailvelope, cmux's Gmail driver and smaller
 * extensions. The sources, with links, are listed in docs/DEVELOPMENT.md (Gmail selectors).
 * None has been checked on a real Gmail account yet. A selector becomes `verified` only after
 * that check (`pnpm gmail:inspect`), with a `verifiedOn` record, an anonymized structure sample
 * in `tests/fixtures/gmail/` and a test.
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
  readonly conversationView: 'on' | 'off';
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

export const GMAIL_SELECTORS = {
  /**
   * The mail app's main area. Gmail sets `role="main"` only once the app has loaded; `.aeF > .nH`
   * exists on routes without it.
   */
  mainArea: candidate(
    ['div[role="main"]', 'div.aeF > div.nH'],
    'high',
    'InboxSDK selectors.ts and the route view; gmail.js; cmux.',
  ),

  /** Subject heading of the open conversation; it carries the conversation id attributes. */
  threadSubject: candidate(
    ['h2[data-legacy-thread-id]', 'h2[data-thread-perm-id]', 'h2.hP', '.ha h2'],
    'high',
    'gmail.js and cmux read `h2.hP`, InboxSDK `.ha h2`; gmail.js and copy-as-markdown find the ids on the h2.',
  ),

  /**
   * The open conversation: subject, messages and inline reply. In split-pane mode the same area
   * also holds the message list, whose rows have no message body.
   */
  threadView: candidate(
    ['div[role="main"]'],
    'medium',
    'cmux takes the `role="main"` area that contains `h2.hP`. InboxSDK finds the container itself (`.a98.iY` since the November 2023 redesign), FlowCrypt `div.if, div.aHU, td.Bu` with `.a98.iY` as the fallback.',
  ),

  /** One expanded message; it carries both message ids. */
  message: candidate(
    ['div.adn[data-message-id]', 'div.adn[data-legacy-message-id]', 'div.adn.ads', 'div.adn'],
    'high',
    'gmail.js, InboxSDK and Mailvelope read the ids from `div.adn.ads`.',
  ),

  /** Body of an expanded message. For nested matches the innermost is kept. */
  messageBody: candidate(
    ['div.a3s'],
    'high',
    '`div.a3s` inside `div.ii.gt` (InboxSDK, gmail.js, cmux). Its second class differs between sources (`aiL`, `aXjCH`), so `.a3s` stands alone.',
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
  messageSender: candidate(
    ['span.gD[email]', 'td.gF span[email]', 'span.gD'],
    'high',
    'gmail.js and cmux use `span.gD`, InboxSDK `td.gF span[email]`.',
  ),

  /** Displayed date of a message; its `title` holds the full, locale-formatted date. */
  messageDate: candidate(
    ['span.g3[title]', '.gK .g3', 'span.g3'],
    'high',
    'InboxSDK `.ads .gK .g3`, gmail.js and cmux; all read the `title`, not the text.',
  ),

  /**
   * Where earlier mail starts inside a message or editor: Gmail's own markers, which are part
   * of the mail HTML, then those of other mail clients whose messages Gmail shows.
   */
  quoteStart: candidate(
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
    '`div.gmail_quote > div.gmail_attr + blockquote.gmail_quote` in InboxSDK test data and FlowCrypt; Google’s Workspace CLI writes the outer `.gmail_quote_container`.',
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
  trimmedContentToggle: candidate(
    ['.ajR', '.yj6qo'],
    'medium',
    'InboxSDK and better-gmail click `.ajR` to show a reply’s quote; copy-as-markdown also skips `.yj6qo`.',
  ),

  /** Draft editor: the compose body. */
  composeEditor: candidate(
    [
      'div[g_editable="true"][contenteditable="true"]',
      'div[role="textbox"][g_editable="true"]',
      'div.Am.Al.editable[contenteditable="true"]',
    ],
    'high',
    'InboxSDK `.Ap [g_editable=true]`, cmux `div[role=textbox][g_editable="true"]`, Mailvelope `.Am.Al`. `aria-label="Message Body"` is translated and not used.',
  ),

  /**
   * Container of one draft: an inline reply, a compose window or the full-screen compose. Its
   * hidden inputs and reply markers are looked up inside it.
   */
  composeContainer: candidate(
    ['div.M9', 'td.I5', 'div.aaZ', 'div[role="dialog"]', 'div.AD'],
    'medium',
    'InboxSDK and gmail.js use `.M9` and `div.AD`, FlowCrypt `div.gA td.I5` and `.aaZ`; compose windows are dialogs.',
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
  themeSurface: candidate(
    ['.bkK > .nH', 'div[role="main"]'],
    'medium',
    'InboxSDK track-gmail-styles.ts: the body is dark when the background of `.bkK > .nH` is dark.',
  ),
} as const satisfies Record<string, SelectorDefinition>;

export type SelectorKey = keyof typeof GMAIL_SELECTORS;

const queries = selectorQueries<SelectorKey>(GMAIL_SELECTORS);

export const SELECTOR_KEYS = queries.keys;

export const { queryFirst, queryFirstOutside, queryAll, matches, closest } = queries;
