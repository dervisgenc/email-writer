/** Eklentinin sayfaya eklediği gölge kök etiketleri. */
const OWN_UI_TAGS = 'email-writer-launcher, email-writer-panel';

/**
 * Eklenti güncellenince veya yeniden kurulunca eski içerik betiği (özellikle
 * Firefox'ta) temizlik yapamadan durdurulur; sayfaya eklediği araç çubuğu ve
 * panel kökleri sahipsiz ve tepkisiz kalır. Yeni oturum, kendi arayüzünü
 * eklemeden önce bunları kaldırır. Kaldırılan kök sayısını döndürür.
 */
export function removeOrphanedUi(document: Document): number {
  const stale = [...document.querySelectorAll(OWN_UI_TAGS)];
  for (const element of stale) {
    element.remove();
  }
  return stale.length;
}
