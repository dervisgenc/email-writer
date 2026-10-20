import { appError, err, ok, type AppError, type Result } from '@writehand/contracts';

/**
 * Writes to the clipboard on a user click: always plain text, plus HTML for formatted
 * content (so tables and lists survive pasting elsewhere). The clipboard is never read
 * and never written without a user action. If writing fails, the text stays selectable in the panel.
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
