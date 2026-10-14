/**
 * Outlook Web'e özgü BÜTÜN seçicilerin tek yeri. Seçiciler ne arayüz
 * bileşenlerinde ne ortak iş mantığında bulunur.
 *
 * DURUM: Bu dosyadaki seçicilerin tamamı `candidate` durumundadır. Açık kaynak
 * eklentilerden, kullanıcı betiklerinden ve kamuya açık `.eml` örneklerindeki
 * gerçek Outlook DOM parçalarından derlenmiştir (Ekim 2026). Gerçek Outlook
 * hesaplarıyla henüz doğrulanmamıştır. Bir seçici doğrulandığında `verified`
 * olarak işaretlenir ve `verifiedOn` kaydı eklenir; yanında onu doğrulayan
 * anonim bir sayfa örneği ve test bulunur (bkz. docs/outlook-web-dogrulama.md).
 *
 * Kurallar:
 * - Üretilmiş (karmakarışık) CSS sınıfları (ör. `GNqVo`, `rps_xxxx`) tek dayanak olmaz.
 * - Arayüz diline bağlı `aria-label` metinleri tek dayanak olmaz; zorunluysa
 *   `languageDependent: true` ile işaretlenir.
 * - `role="textbox"` tek başına e-posta editörü demek değildir.
 */

export type SelectorStatus = 'candidate' | 'verified';
export type EvidenceLevel = 'high' | 'medium' | 'low';

export interface VerificationRecord {
  readonly accountType: 'work' | 'personal';
  readonly uiLanguage: string;
  readonly browser: string;
  readonly conversationView: 'on' | 'off';
  readonly editor: 'inline-reply' | 'popout' | 'new-message';
  readonly date: string;
}

export interface SelectorDefinition {
  /** Sırayla denenir; ilk eşleşen kullanılır. */
  readonly selectors: readonly string[];
  readonly status: SelectorStatus;
  /** Kamuya açık kaynaklardaki kanıtın gücü (doğrulama yerine geçmez). */
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

export const OUTLOOK_SELECTORS = {
  /** Okuma bölmesi; konuşma görünümünde ve tek ileti görünümünde farklı kimlikler. */
  readingPane: candidate(
    ['#ReadingPaneContainerId', '#ConversationReadingPaneContainer', '#ItemReadingPaneContainer'],
    'high',
    'Toggl, PreMiD, Clockify eklentilerinde kullanılıyor.',
  ),

  /** İleti listesinde seçili satır; `data-convid` veya satır kimliği konuşmayı ayırır. */
  selectedConversation: candidate(
    [
      '[role="option"][aria-selected="true"][data-convid]',
      'div[data-focusable-row="true"][aria-selected="true"]',
    ],
    'medium',
    'Klasör değişiminden sonra bir süre bulunmayabilir; arama sonuçlarında yoktur. URL kimliği yedektir.',
  ),

  /** Konuşmadaki her bir açık mesajın gövdesi. İç içe eşleşmede en içteki tutulur. */
  messageBody: candidate(
    ['[id^="UniqueMessageBody"]', 'div[role="document"]'],
    'medium',
    'Kamuya açık örneklerde `div#UniqueMessageBody_N[role="document"]` görülüyor; numara mesaj başına.',
  ),

  /**
   * Mesaj kapsayıcısı: gövdeyi ve başlığı (gönderen, tarih) birlikte içerir.
   * KANIT BULUNAMADI: Bulunamazsa gövdenin üst elemanı kullanılır; birden fazla
   * gövde içeren eşleşme kapsayıcı sayılmaz.
   */
  messageContainer: candidate(
    ['[role="listitem"]', '[aria-expanded][tabindex]'],
    'low',
    'Gerçek sayfada belirlenmeli.',
  ),

  /** Kapalı (gövdesi yüklenmemiş) mesaj satırı. KANIT BULUNAMADI. */
  collapsedMessage: candidate(
    ['[role="listitem"][aria-expanded="false"]'],
    'low',
    'Eşleşme yoksa kapalı mesaj sayısı uydurulmaz (null).',
  ),

  /** Mesaj başlığındaki gönderen. KANIT ZAYIF; görünen ad kullanılır, adres saklanmaz. */
  messageSender: candidate(
    ['[id^="MSG_"][id$="_FROM"]', 'span[title*="@"]', 'button[title*="@"]'],
    'low',
    'Gerçek sayfada belirlenmeli.',
  ),

  /** Gönderilme zamanı. ISO tarih yalnızca `time[datetime]` varsa alınır. KANIT BULUNAMADI. */
  messageDate: candidate(['time[datetime]', 'time'], 'low', 'Görünen tarih metni ayrıştırılmaz.'),

  /** Konuşma konusu; yalnızca gösterim içindir, kimlik olarak kullanılmaz. */
  subject: candidate(['div[role="heading"][title]', '[role="heading"]'], 'medium', 'Toggl, PreMiD.'),

  /**
   * Mesaj veya editör içinde önceki yazışmanın başladığı yer. Outlook gösterimde
   * e-posta HTML'indeki kimliklerin başına `x_` (alıntı içinde `x_x_`) ekler;
   * bu yüzden sonek eşleşmesi kullanılır.
   */
  quoteStart: candidate(
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
    'Outlook yanıt yapısı: #Signature → #appendonsend → hr → #divRplyFwdMsg.',
  ),

  /** İmza bölümü. "Teşekkürler" gibi kelimeler tek başına imza sayılmaz. */
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
    '#Signature çoğunlukla `elementToProof` sınıfıyla gelir.',
  ),

  /** Taslak editörü (RoosterJS tabanlı `contenteditable`). */
  composeEditor: candidate(
    [
      'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
      'div[contenteditable="true"][aria-multiline="true"]',
    ],
    'high',
    'Sayfadaki tek çok satırlı metin kutusu olduğu belirtiliyor (Briskine, scrum_helper).',
  ),

  /** Okuma bölmesine yerleşik yanıt taslağının bölgesi. */
  inlineReplyRegion: candidate(['[id^="docking_InitVisiblePart"]'], 'medium', 'Briskine.'),

  /** Editör olmadığı bilinen düzenlenebilir alanların üst bölgeleri. */
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
    'Arama, alıcı ve konu alanları.',
  ),

  /** Hesap ipucu: yalnızca yerel ve opak hesap kapsamı üretmek için okunur. */
  accountHint: candidate(
    [
      '#owa-me-control-container button[aria-label]',
      '#O365_MainLink_Me',
      '#O365_UniversalMeContainer',
      '#mectrl_main_trigger',
    ],
    'medium',
    'Erişilebilir ad özetlenir (hash); ham değer saklanmaz.',
    true,
  ),
} as const satisfies Record<string, SelectorDefinition>;

export type SelectorKey = keyof typeof OUTLOOK_SELECTORS;

export const SELECTOR_KEYS = Object.keys(OUTLOOK_SELECTORS) as readonly SelectorKey[];

/** Posta dışındaki Outlook modülleri: bu yollarda düğme eklenmez. */
export const NON_MAIL_PATH_PREFIXES = ['/calendar', '/people', '/files', '/tasks', '/bookings', '/todo'];

/** URL'deki ileti/konuşma kimliği: `/mail/<klasör>/id/<id>`, `/deeplink/read/<id>`, `/deeplink/readconv/<id>`. */
export const URL_ITEM_ID = /\/(?:id|read|readconv)\/([^/?#]+)/;

export function selectorList(key: SelectorKey): string {
  return OUTLOOK_SELECTORS[key].selectors.join(', ');
}

/** İlk eşleşen seçiciyle ilk elemanı döndürür. */
export function queryFirst(root: ParentNode, key: SelectorKey): HTMLElement | null {
  for (const selector of OUTLOOK_SELECTORS[key].selectors) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/** Bütün seçicilerin eşleşmelerini belge sırasıyla ve tekrarsız döndürür. */
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
