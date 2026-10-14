import { matches } from '../discovery/selectors';
import type { ElementRole } from './extract-text-blocks';

/**
 * Outlook işaretlerine göre metin bölgelerini sınıflandırır: önceki yazışmanın
 * başladığı yer, imza ve eklentinin kendi arayüzü. "Regards" veya
 * "Teşekkürler" gibi kelimeler tek başına imza sayılmaz.
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
