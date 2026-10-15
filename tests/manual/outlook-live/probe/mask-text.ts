/**
 * Gerçek e-posta içeriğini terminale yazmadan biçimini göstermek için metni
 * maskeler: büyük harf → X, diğer harfler → x, rakam → 0. Boşluk, satır sonu
 * ve noktalama korunur; böylece selamlama, imza veya tarih biçimi görülür,
 * içerik görülmez (implementation_details.md §17.2).
 */
export function maskText(value: string, maxLength = 80): string {
  const masked = value.replace(/\p{Lu}|\p{L}|\p{N}|\n/gu, (char) => {
    if (char === '\n') {
      return '⏎';
    }
    if (/\p{N}/u.test(char)) {
      return '0';
    }
    return /\p{Lu}/u.test(char) ? 'X' : 'x';
  });
  return masked.length > maxLength ? `${masked.slice(0, maxLength)}…(+${masked.length - maxLength})` : masked;
}

/**
 * Kimlik değerindeki sayıları ve uzun opak parçaları (ör. posta kutusu öğe
 * kimlikleri) gizler; Outlook'un sabit ön ek ve sonekleri görünür kalır.
 */
export function maskIdentifier(value: string): string {
  return value
    .split(/([_\-:.])/)
    .map((part) => (part.length >= 16 && /\d/.test(part) ? '<opak>' : part.replace(/\d+/g, 'N')))
    .join('');
}
