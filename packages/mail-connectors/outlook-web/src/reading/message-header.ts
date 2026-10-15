import { messageBodies } from '../discovery/locate-thread';
import { MESSAGE_HEADER_PART_ID, queryAll, queryFirstOutside } from '../discovery/selectors';
import { opaqueHash, type IdentityRegistry } from '../identity/identity-registry';

const MAX_LABEL_LENGTH = 200;

export interface MessageHeader {
  readonly senderLabel: string | null;
  /** Görünen tarih metni; dile ve bölgeye bağlı olduğu için ayrıştırılmaz. */
  readonly sentAtText: string | null;
}

/** Görünen metni tek satıra indirir; boşsa `null`. */
export function labelText(element: Element | null): string | null {
  const text = element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text === '' ? null : text.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Gönderen metninden (`Ad Soyad <ad.soyad@ornek.com>`) görünen adı ayırır.
 * Adres saklanmaz: köşeli parantez içindeki ve çıplak adresler atılır; geriye
 * ad kalmazsa ad bilinmiyor sayılır.
 */
export function senderDisplayName(text: string): string | null {
  const name = text
    .replace(/<[^<>]*@[^<>]*>/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name === '' ? null : name.slice(0, MAX_LABEL_LENGTH);
}

/** Elemanın içindeki ileti başlığı parçalarının farklı öğe kimlikleri. */
function headerItemIds(element: Element): Set<string> {
  const itemIds = new Set<string>();
  for (const part of queryAll(element, 'messageHeaderPart')) {
    const itemId = MESSAGE_HEADER_PART_ID.exec(part.id)?.[1];
    if (itemId !== undefined) {
      itemIds.add(itemId);
    }
  }
  return itemIds;
}

/**
 * Bir mesajın kapsayıcısı: gövdeyi ve aynı iletinin başlığını birlikte içeren
 * en küçük üst eleman. Yukarı çıkarken ikinci bir gövde veya başka bir iletinin
 * başlığı görülürse durulur; aksi halde komşu mesajın göndereni bu mesaja
 * atanabilirdi. Başlık bulunamazsa gövdenin üst elemanı kullanılır ve gönderen
 * ile tarih bilinmiyor sayılır.
 */
export function messageContainerOf(body: HTMLElement, threadRoot: Element): HTMLElement {
  for (
    let element = body.parentElement;
    element !== null && threadRoot.contains(element);
    element = element.parentElement
  ) {
    if (messageBodies(element).length > 1) {
      break;
    }
    const itemIds = headerItemIds(element);
    if (itemIds.size > 1) {
      break;
    }
    if (itemIds.size === 1) {
      return element;
    }
  }
  return body.parentElement ?? body;
}

/**
 * Mesajın kimliği. Outlook'un ileti kimliği başlıkta görünüyorsa ondan
 * türetilen opak özet kullanılır; böylece kullanıcı başka mesaja geçip geri
 * döndüğünde aynı mesaj aynı kimliği alır ve bağlamda iki kez sayılmaz.
 * Görünmüyorsa kimlik yalnızca bu DOM elemanının ömrü boyunca geçerlidir.
 */
export function messageKeyOf(container: HTMLElement, registry: IdentityRegistry): string {
  const itemIds = headerItemIds(container);
  const [itemId] = itemIds;
  return itemIds.size === 1 && itemId !== undefined
    ? `msg-${opaqueHash(itemId)}`
    : registry.keyFor(container, 'msg');
}

/**
 * Gönderen ve görünen tarih yalnızca başlıkta, yani gövdenin dışında aranır:
 * e-posta HTML'i benzer kimlikler veya adresler içerebilir.
 */
export function readMessageHeader(container: HTMLElement, body: HTMLElement): MessageHeader {
  const sender = queryFirstOutside(container, body, 'messageSender');
  // "X on behalf of Y" gösteriminde iletinin yazarı son kişi kartıdır.
  const author = sender === null ? null : (queryAll(sender, 'senderPersona').at(-1) ?? sender);
  return {
    senderLabel: author === null ? null : senderDisplayName(author.textContent ?? ''),
    sentAtText: labelText(queryFirstOutside(container, body, 'messageDate')),
  };
}
