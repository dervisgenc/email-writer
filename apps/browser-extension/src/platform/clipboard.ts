import { appError, err, ok, type AppError, type Result } from '@email-writer/contracts';

/**
 * Kullanıcı tıklamasıyla panoya yazar: her zaman düz metin, biçimli içerikte
 * ayrıca HTML (tablo ve listeler başka yere yapıştırınca korunur). Pano okunmaz
 * ve kullanıcı eylemi olmadan yazılmaz. Yazılamazsa metin panelde seçilebilir kalır.
 */
export async function copyText(content: {
  text: string;
  html: string | null;
}): Promise<Result<void, AppError>> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    return err(appError('CLIPBOARD_UNAVAILABLE'));
  }
  try {
    if (content.html !== null && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([content.text], { type: 'text/plain' }),
          'text/html': new Blob([content.html], { type: 'text/html' }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(content.text);
    }
    return ok(undefined);
  } catch {
    return err(appError('CLIPBOARD_UNAVAILABLE'));
  }
}
