/**
 * Outlook Web'e özgü BÜTÜN seçicilerin tek yeri. Seçiciler ne arayüz
 * bileşenlerinde ne ortak iş mantığında bulunur.
 *
 * DURUM: Adaylar açık kaynak eklentilerden, kullanıcı betiklerinden ve kamuya
 * açık `.eml` örneklerindeki gerçek Outlook DOM parçalarından derlendi (Ekim
 * 2026). Gerçek hesapla doğrulananlar `verified` durumundadır ve `verifiedOn`
 * kaydı taşır; yanında onu doğrulayan anonim sayfa örneği ve test bulunur
 * (`tests/fixtures/outlook/`, docs/outlook-web-dogrulama.md). Bir tanımda
 * birden fazla seçici varsa hangisinin doğrulandığı `note` içinde yazar.
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
  /** Okuma bölmesi konuşmanın bütün mesajlarını mı, yalnızca seçili mesajı mı gösteriyor. */
  readonly readingPane: 'conversation' | 'selected-message';
  /** Okuma seçicileri editör açık değilken doğrulanır (`null`). */
  readonly editor: 'inline-reply' | 'popout' | 'new-message' | null;
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

function verified(
  selectors: readonly string[],
  evidence: EvidenceLevel,
  note: string,
  verifiedOn: readonly VerificationRecord[],
  languageDependent = false,
): SelectorDefinition {
  return { selectors, status: 'verified', evidence, languageDependent, note, verifiedOn };
}

/** İş hesabı, İngilizce arayüz, konuşma görünümü açık, okuma bölmesinde yalnızca seçili mesaj. */
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
 * Outlook, okunan bir iletinin başlık parçalarına `MSG_<öğe kimliği>_<PARÇA>`
 * kimliği verir (ör. `MSG_…_FROM`, `MSG_…_DATETIME`). Aynı öğe kimliği bir
 * iletinin başlığını gövdesiyle aynı kapsayıcıda birbirine bağlar.
 */
export const MESSAGE_HEADER_PART_ID = /^MSG_(.+)_(?:FROM|TO|CC|BCC|SUBJECT|DATETIME)$/;

/**
 * Okuma bölmesindeki konu başlığının kimliği `CONV_<konuşma belirteci>_SUBJECT`.
 * Belirteç aynı konuşma için kararlıdır ve ileti listesinin kaydırılmasından
 * etkilenmez (sanal liste, ekran dışındaki seçili satırı DOM'dan çıkarır).
 */
export const CONVERSATION_SUBJECT_ID = /^CONV_(.+)_SUBJECT$/;

export const OUTLOOK_SELECTORS = {
  /** Okuma bölmesi; konuşma görünümünde ve tek ileti görünümünde farklı kimlikler. */
  readingPane: verified(
    ['#ReadingPaneContainerId', '#ConversationReadingPaneContainer', '#ItemReadingPaneContainer'],
    'high',
    '#ReadingPaneContainerId doğrulandı; seçili mesaj görünümünde içinde #ItemReadingPaneContainer var.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** İleti listesinde seçili satır; `data-convid` veya satır kimliği konuşmayı ayırır. */
  selectedConversation: verified(
    [
      '[role="option"][aria-selected="true"][data-convid]',
      'div[data-focusable-row="true"][aria-selected="true"]',
    ],
    'medium',
    'İlk seçici doğrulandı (satırda data-focusable-row da var). Klasör değişiminden sonra bir süre bulunmayabilir; arama sonuçlarında yoktur. URL kimliği yedektir.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Konuşmadaki her bir açık mesajın gövdesi. İç içe eşleşmede en içteki tutulur. */
  messageBody: verified(
    ['[id^="UniqueMessageBody"]', 'div[role="document"]'],
    'medium',
    '`div#UniqueMessageBody_N[role="document"]` doğrulandı; `[data-test-id="mailMessageBodyContainer"]` içinde.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * İleti başlığının parçaları (`MSG_<öğe kimliği>_FROM` vb.). Mesaj kapsayıcısı
   * bunlardan türetilir: gövdeyi içeren ve tek bir öğe kimliğinin başlığını
   * taşıyan en küçük üst eleman. Üretilmiş sınıflara veya role dayanılmaz.
   */
  messageHeaderPart: verified(
    ['[id^="MSG_"]'],
    'medium',
    'SUBJECT, FROM, TO, CC ve DATETIME parçaları aynı öğe kimliğini taşıyor.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Kapalı (gövdesi yüklenmemiş) mesaj satırı. KANIT BULUNAMADI. */
  collapsedMessage: candidate(
    ['[role="listitem"][aria-expanded="false"]'],
    'low',
    'Eşleşme yoksa kapalı mesaj sayısı uydurulmaz (null).',
  ),

  /**
   * Mesaj başlığındaki gönderen. Görünen metin `Ad <adres>` biçiminde olabilir;
   * yalnızca görünen ad kullanılır, adres saklanmaz. `title*="@"` gibi yedekler
   * alıcıları veya alıntıdaki adresleri yakaladığı için kullanılmaz.
   */
  messageSender: verified(['[id^="MSG_"][id$="_FROM"]'], 'medium', 'role="heading" taşıyor.', [
    WORK_EN_FIREFOX_SELECTED_MESSAGE,
  ]),

  /**
   * Gönderen başlığındaki kişi kartları. "X on behalf of Y" gösteriminde iki
   * kart bulunur: gönderen hesap (Sender) ve iletinin yazarı (From). Yazar
   * son karttır; aradaki bağlaç metni dile bağlı olduğu için kullanılmaz.
   */
  senderPersona: verified(
    ['[data-lpc-hover-target-id]', '[role="button"][aria-haspopup="dialog"]'],
    'medium',
    'İkisi de aynı kişi kartı elemanını gösteriyor; "on behalf of" iletisinde iki kart doğrulandı.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * Görünen gönderilme zamanı (ör. "Wed 15-Oct-26 9:12 AM"). Makinece okunur
   * tarih yok; dile ve bölgeye bağlı metin ayrıştırılmaz, `sentAt` boş kalır.
   */
  messageDate: verified(
    ['[data-testid="SentReceivedSavedTime"]', '[id^="MSG_"][id$="_DATETIME"]'],
    'medium',
    'İkisi aynı elemanı gösteriyor.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /**
   * Konuşma konusu; yalnızca gösterim içindir, kimlik olarak kullanılmaz.
   * Okuma bölmesindeki gönderen, alıcı ve tarih de `role="heading"` taşıdığı
   * için genel `[role="heading"]` seçicisi kullanılmaz.
   */
  subject: verified(['[role="heading"][id^="CONV_"][id$="_SUBJECT"]'], 'medium', 'Metin ve title taşıyor.', [
    WORK_EN_FIREFOX_SELECTED_MESSAGE,
  ]),

  /**
   * Mesaj veya editör içinde önceki yazışmanın başladığı yer. Outlook gösterimde
   * e-posta HTML'indeki kimliklerin başına `x_` (alıntı içinde `x_x_`) ekler;
   * bu yüzden sonek eşleşmesi kullanılır.
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
    'Outlook yanıt yapısı: #Signature → #appendonsend → hr → #divRplyFwdMsg. Gelen iletide [id$="divRplyFwdMsg"] ve [id$="appendonsend"] doğrulandı; diğerleri aday.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
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

  /**
   * Fluent UI v9 sağlayıcısı: Outlook'un tema renkleri bu elemanda CSS
   * değişkeni olarak tanımlıdır (`--colorNeutralBackground1` vb.). Eklenti
   * arayüzü bu renklerle Outlook temasına uyar.
   */
  themeProvider: verified(
    ['.fui-FluentProvider'],
    'high',
    'Renk değişkenleri (--colorNeutralBackground1, --colorBrandBackground vb.) gerçek sayfada okundu.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
  ),

  /** Hesap ipucu: yalnızca yerel ve opak hesap kapsamı üretmek için okunur. */
  accountHint: verified(
    [
      '#owa-me-control-container button[aria-label]',
      '#O365_MainLink_Me',
      '#O365_UniversalMeContainer',
      '#mectrl_main_trigger',
    ],
    'medium',
    'İlk seçici doğrulandı. Erişilebilir ad özetlenir (hash); ham değer saklanmaz.',
    [WORK_EN_FIREFOX_SELECTED_MESSAGE],
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

/**
 * İlk eşleşen seçiciyle, `excluded` dışındaki ilk elemanı döndürür. Mesaj
 * başlığı aranırken e-posta gövdesindeki benzer işaretler böylece dışlanır.
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
