/**
 * Editöre düz metin yerleştirmenin tek dar arayüzü. Hangi yöntemin
 * kullanıldığı bu dosyanın dışına sızmaz; desteklenmeyen bir editörde
 * deneysel yöntemler peş peşe denenmez.
 */
export interface EditorWriter {
  readonly id: string;
  /**
   * `range` içeriğini tek bir düzenleme olarak `text` ile değiştirir; boş metin
   * aralığı siler. `true` dönmesi başarı kanıtı değildir: çağıran, editörü
   * tekrar okuyarak sonucu doğrular.
   */
  replaceRange(editor: HTMLElement, range: Range, text: string): boolean;
  /**
   * `range` içeriğini tek bir düzenleme olarak biçimli içerikle değiştirir. HTML,
   * eklentinin kendi ürettiği ve kaçışladığı içeriktir. Sonuç yine okunarak doğrulanır.
   */
  insertHtml(editor: HTMLElement, range: Range, html: string): boolean;
}

function selectRange(document: Document, editor: HTMLElement, range: Range): boolean {
  const selection = document.getSelection();
  if (selection === null) {
    return false;
  }
  editor.focus({ preventScroll: true });
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * İlk teknik deneme: hedef aralık seçilip `execCommand('insertText')` ile
 * yazılır. API kullanımdan kaldırılmış olsa da editörün kendi girdi olaylarını
 * ve geri alma geçmişini koruduğu için bazı editörlerde hâlâ tek güvenilir
 * yoldur. Outlook Web / tarayıcı kombinasyonlarında gerçek hesapla
 * doğrulanmadan desteklenmiş sayılmaz (bkz. docs/outlook-web-dogrulama.md).
 */
export function createExecCommandWriter(document: Document): EditorWriter {
  return {
    id: 'exec-command-insert-text',
    replaceRange(editor, range, text) {
      if (!selectRange(document, editor, range)) {
        return false;
      }
      if (text.length === 0) {
        return range.collapsed || document.execCommand('delete', false);
      }
      return document.execCommand('insertText', false, text);
    },
    insertHtml(editor, range, html) {
      // `insertHTML` de editörün girdi olaylarını ve geri alma geçmişini korur.
      return selectRange(document, editor, range) && document.execCommand('insertHTML', false, html);
    },
  };
}

/**
 * Alternatif deneme: Outlook'un editörü RoosterJS, sentetik bir `paste`
 * olayında tarayıcının yapıştırmasını iptal edip kendi yapıştırma mantığını
 * çalıştırır, kendi geri alma kaydını alır ve içerik değişikliğini bildirir.
 * `execCommand('insertText')` ise yalnızca editörün önbelleğini geçersiz kılar.
 *
 * Firefox'ta içerik betiğinde oluşturulan `DataTransfer` sayfa koduna
 * erişilemeyebilir (Xray sınırı); bu yöntem orada doğrulanmadan kullanılmaz.
 * İki yöntem birbiri ardına denenmez: hangisinin kullanılacağına gerçek hesap
 * doğrulaması karar verir.
 */
export function createPasteEventWriter(document: Document): EditorWriter {
  return {
    id: 'synthetic-paste-event',
    replaceRange(editor, range, text) {
      if (!selectRange(document, editor, range)) {
        return false;
      }
      if (text.length === 0) {
        return range.collapsed || document.execCommand('delete', false);
      }
      return dispatchPaste(editor, { 'text/plain': text });
    },
    insertHtml(editor, range, html) {
      return selectRange(document, editor, range) && dispatchPaste(editor, { 'text/html': html });
    },
  };
}

function dispatchPaste(editor: HTMLElement, items: Record<string, string>): boolean {
  const data = new DataTransfer();
  for (const [type, value] of Object.entries(items)) {
    data.setData(type, value);
  }
  const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
  editor.dispatchEvent(event);
  // Editör olayı işlediyse tarayıcının varsayılan yapıştırmasını iptal eder.
  return event.defaultPrevented;
}
