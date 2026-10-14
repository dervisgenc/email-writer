import { appError, err, ok, type AppError, type Result } from '@email-writer/contracts';

/**
 * Kullanıcı tıklamasıyla panoya düz metin yazar. Pano okunmaz ve kullanıcı
 * eylemi olmadan yazılmaz. Yazılamazsa metin panelde seçilebilir kalır.
 */
export async function copyText(text: string): Promise<Result<void, AppError>> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    return err(appError('CLIPBOARD_UNAVAILABLE'));
  }
  try {
    await navigator.clipboard.writeText(text);
    return ok(undefined);
  } catch {
    return err(appError('CLIPBOARD_UNAVAILABLE'));
  }
}
