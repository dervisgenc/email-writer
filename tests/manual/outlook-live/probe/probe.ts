/**
 * Gerçek Outlook sayfasında, WebDriver BiDi'nin yalıtılmış "sandbox"
 * ortamında çalışan inceleme girişi. Sandbox, content script gibi sayfanın
 * DOM'unu görür ama sayfanın JavaScript nesnelerine karışmaz.
 *
 * Bütün çıktılar maskelidir: gerçek e-posta metni, ad veya adres döndürülmez.
 */
import { createOutlookWebConnector, OUTLOOK_SELECTORS } from '@email-writer/outlook-web';

import { OWN_UI_SELECTOR } from '../../../../apps/browser-extension/src/bootstrap/mail-provider';

import { describeStructure } from './describe-structure';
import { conversationRows, describeRows } from './message-list';
import { readThreadReport } from './read-thread-report';

const messageBodySelector = OUTLOOK_SELECTORS.messageBody.selectors.join(', ');

/** Hedef, bir seçici anahtarı (ör. `readingPane`) veya doğrudan CSS seçicisidir. */
function resolveRoot(target: string): Element | null {
  const selector = Object.hasOwn(OUTLOOK_SELECTORS, target)
    ? OUTLOOK_SELECTORS[target as keyof typeof OUTLOOK_SELECTORS].selectors.join(', ')
    : target;
  return document.querySelector(selector);
}

export function structure(target = 'readingPane', maxDepth = 40, maxLines = 400, showBodies = false) {
  const root = resolveRoot(target);
  if (root === null) {
    return { found: false, lines: [] };
  }
  return {
    found: true,
    lines: describeStructure(root, {
      maxDepth,
      maxLines,
      // E-posta gövdesinin içi yapısal olarak gerekmedikçe dökülmez.
      collapse: showBodies ? ':not(*)' : messageBodySelector,
    }),
  };
}

/** Seçici anahtarlarındaki her seçicinin ayrı eşleşme sayısı; içerik taşımaz. */
export function selectorMatches(key?: string) {
  const keys = (
    key === undefined ? Object.keys(OUTLOOK_SELECTORS) : [key]
  ) as (keyof typeof OUTLOOK_SELECTORS)[];
  return keys
    .filter((name) => Object.hasOwn(OUTLOOK_SELECTORS, name))
    .map((name) => ({
      key: name,
      status: OUTLOOK_SELECTORS[name].status,
      selectors: OUTLOOK_SELECTORS[name].selectors.map((selector) => ({
        selector,
        matches: document.querySelectorAll(selector).length,
      })),
    }));
}

export function rows(selector?: string) {
  return describeRows(document, selector);
}

/** Satırdaki eylem düğmeleri (sil, arşivle, bayrak, seçim kutusu) tıklanmamalıdır. */
const ROW_ACTION_SELECTOR = 'button, [role="button"], [role="checkbox"], input, a[href]';

/** Kaydırmadan sonra sanal listenin yeniden çizilmesi için beklenen süre. */
const SCROLL_SETTLE_MS = 400;

/**
 * Tıklanacak satırın konuşma kimliği. Sanal liste kaydırıldığında satırların
 * DOM sırası değişir; hedef bu yüzden sırayla değil kimlikle izlenir. Kimlik
 * yalnızca sandbox içinde kalır, çıktıya yazılmaz.
 */
let targetConversation: string | null = null;

function rowByConversation(conversationId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[role="option"][data-convid="${CSS.escape(conversationId)}"]`);
}

/** Satırın içinde, hiçbir eylem düğmesine denk gelmeyen bir tıklama noktası (görünüm koordinatı). */
function safePointIn(row: HTMLElement): { x: number; y: number } | null {
  const rect = row.getBoundingClientRect();
  const y = Math.round(rect.top + rect.height / 2);
  for (const ratio of [0.4, 0.5, 0.3, 0.6, 0.25]) {
    const x = Math.round(rect.left + rect.width * ratio);
    const hit = document.elementFromPoint(x, y);
    if (hit !== null && row.contains(hit) && hit.closest(ROW_ACTION_SELECTOR) === null) {
      return { x, y };
    }
  }
  return null;
}

/**
 * Satırı görünür alana kaydırır, liste yeniden çizildikten sonra satırı
 * kimliğiyle yeniden bulur ve güvenli tıklama noktasını verir. Gerçek fare
 * olayı BiDi ile bu noktaya hemen ardından gönderilir.
 */
export async function rowClickPoint(
  index: number,
  selector?: string,
): Promise<{ x: number; y: number } | null> {
  const conversationId = conversationRows(document, selector)[index]?.getAttribute('data-convid') ?? null;
  targetConversation = conversationId;
  const row = conversationId === null ? null : rowByConversation(conversationId);
  if (conversationId === null || row === null) {
    return null;
  }
  row.scrollIntoView({ block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, SCROLL_SETTLE_MS));
  const settled = rowByConversation(conversationId);
  return settled === null ? null : safePointIn(settled);
}

/** Son hedeflenen satır seçili mi? Seçilmediyse açılan konuşma okunmaz. */
export function targetRowSelected(): boolean {
  const row = targetConversation === null ? null : rowByConversation(targetConversation);
  return row?.getAttribute('aria-selected') === 'true';
}

/**
 * Okuma bölmesinde gösterilen iletinin parmak izi: konu ve gönderen başlığının
 * kimlikleri. Yalnızca bölme çizimi tamamlandığında (konu, gönderen ve gövde
 * birlikte varken) değer üretir. Kimlikler sandbox dışına verilmez.
 */
function readingPaneFingerprint(): string | null {
  const pane = document.querySelector(OUTLOOK_SELECTORS.readingPane.selectors.join(', '));
  const subject = pane?.querySelector(OUTLOOK_SELECTORS.subject.selectors.join(', '));
  const sender = pane?.querySelector(OUTLOOK_SELECTORS.messageSender.selectors.join(', '));
  const body = pane?.querySelector(messageBodySelector);
  return subject && sender && body ? `${subject.id}|${sender.id}` : null;
}

let markedFingerprint: string | null = null;

/** Tıklamadan önce okuma bölmesinin durumunu işaretler. */
export function markReadingPane(): void {
  markedFingerprint = readingPaneFingerprint();
}

/** Okuma bölmesi işaretten sonra yeni bir iletiyi tamamen çizdi mi? */
export function readingPaneChanged(): boolean {
  const current = readingPaneFingerprint();
  return current !== null && current !== markedFingerprint;
}

export function readThread() {
  return readThreadReport(document);
}

/** Outlook'un tema renkleri (eklentinin kullandığı okuyucuyla); içerik taşımaz. */
export function theme() {
  const { connector, readTheme } = createOutlookWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR });
  try {
    return readTheme();
  } finally {
    connector.dispose();
  }
}

/**
 * Eklentinin sayfadaki düğmelerinin konumu ve altında kalan Outlook düğmeleri.
 * Çakışmayı içerik okumadan denetlemek içindir: yalnızca rol ve konum verilir.
 */
export function launcherLayout() {
  const hosts = Array.from(document.querySelectorAll('email-writer-launcher'));
  return hosts.map((host) => {
    const container = host.shadowRoot?.querySelector<HTMLElement>('.ew-root')?.parentElement ?? null;
    const box = container?.getBoundingClientRect();
    const kind = host.shadowRoot?.querySelector('.ew-compose-bar') ? 'compose-toolbar' : 'thread-launcher';
    if (box === undefined || box.width === 0) {
      return { kind, visible: false, overlaps: [] };
    }
    const overlaps = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], [role="menuitem"]'),
    )
      .filter((element) => !element.closest('email-writer-launcher'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.left < box.right &&
          rect.right > box.left &&
          rect.top < box.bottom &&
          rect.bottom > box.top
        );
      })
      .map((element) => element.getAttribute('role') ?? element.tagName.toLowerCase());
    return {
      kind,
      visible: true,
      box: {
        left: Math.round(box.left),
        top: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
      viewport: { width: innerWidth, height: innerHeight },
      overlaps,
    };
  });
}

/** Kimliği göstermeden karşılaştırmak için kısa özet (FNV-1a). */
function shortHash(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

let watched: {
  connector: ReturnType<typeof createOutlookWebConnector>['connector'];
  events: string[];
} | null = null;

/** Bağlantının ve okuma bölmesinin içeriksiz durumu (tanı için). */
function watchedState() {
  const state = watched?.connector.getPageState();
  const pane = document.querySelector('#ReadingPaneContainerId');
  const editor =
    pane?.querySelector('[role="textbox"][contenteditable="true"][aria-multiline="true"]') ?? null;
  const row = document.querySelector('[role="option"][aria-selected="true"][data-convid]');
  return {
    thread: state?.activeThread?.threadKey ?? null,
    composers: state?.composers.map((composer) => composer.threadKey ?? 'yeni') ?? [],
    bodies: pane?.querySelectorAll(messageBodySelector).length ?? 0,
    editor: editor !== null,
    quote: editor?.querySelector('[id$="divRplyFwdMsg"], [id$="appendonsend"]') !== null && editor !== null,
    selectedRow: shortHash(row?.getAttribute('data-convid') ?? null),
  };
}

/**
 * Tanı: eklentinin kullandığı bağlantıyı sayfada başlatır ve olaylarını kaydeder.
 * `watchState` ile durum ve olaylar okunur, `watchStop` ile temizlenir.
 */
export function watchStart() {
  watched?.connector.dispose();
  const { connector } = createOutlookWebConnector({ document, ownUiSelector: OWN_UI_SELECTOR });
  const events: string[] = [];
  connector.subscribe((event) => {
    events.push(
      event.type === 'active-thread-changed'
        ? `${event.type}(${event.current?.threadKey ?? 'null'})`
        : 'ref' in event
          ? `${event.type}(${event.ref.threadKey ?? 'yeni'})`
          : event.type,
    );
  });
  watched = { connector, events };
  return watchedState();
}

export function watchState() {
  const state = watchedState();
  const events = watched?.events.splice(0) ?? [];
  return { ...state, events };
}

export function watchStop(): void {
  watched?.connector.dispose();
  watched = null;
}

/** Okuma bölmesindeki "Reply" düğmesinin güvenli tıklama noktası; yoksa `null`. */
export function replyClickPoint(): { x: number; y: number } | null {
  const pane = document.querySelector('#ReadingPaneContainerId');
  const target = Array.from(pane?.querySelectorAll<HTMLElement>('button, [role="menuitem"]') ?? []).find(
    (element) => element.getAttribute('aria-label') === 'Reply' && element.getBoundingClientRect().width > 0,
  );
  if (target === undefined) {
    return null;
  }
  const rect = target.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const hit = document.elementFromPoint(x, y);
  return hit !== null && target.contains(hit) ? { x, y } : null;
}
