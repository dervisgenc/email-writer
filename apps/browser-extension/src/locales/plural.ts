/**
 * Sayıyı dilin çoğul kuralına uygun sözcükle yazar ("1 message", "2 messages";
 * Fransızcada 0 da tekildir). Kural `Intl.PluralRules`'tan gelir; dosyalarda
 * dile özel koşul yazılmaz.
 */
export function countWith(locale: string): (count: number, one: string, other: string) => string {
  const rules = new Intl.PluralRules(locale);
  return (count, one, other) => `${count} ${rules.select(count) === 'one' ? one : other}`;
}
