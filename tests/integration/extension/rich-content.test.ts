import type { ApplyRequest } from '@email-writer/contracts';
import { describe, expect, it } from 'vitest';

import {
  clipboardContent,
  withRichContent,
} from '../../../apps/browser-extension/src/controllers/rich-content';
import { scopeA } from '../../fixtures/synthetic-mail/threads';

const composerRef = { scope: scopeA, composerKey: 'c1', threadKey: 'thread-a' };
const body = (text: string): ApplyRequest => ({
  applyOperationId: 'a',
  target: { mode: 'replace-body', composerRef, expectedRevision: 1 },
  text,
});

describe('Biçimli içerik hazırlığı', () => {
  it('cümle içindeki seçime giden metni olduğu gibi bırakır', () => {
    const request: ApplyRequest = {
      applyOperationId: 'a',
      target: { mode: 'replace-selection', composerRef, expectedRevision: 1, selectionId: 's' },
      text: '**salon**',
    };
    expect(withRichContent(request)).toBe(request);
  });

  it('biçimsiz metinde HTML üretmez; yalnızca düz metni temizler', () => {
    expect(withRichContent(body('Merhaba,\n\nTeşekkürler.'))).toEqual(body('Merhaba,\n\nTeşekkürler.'));
  });

  it('tablo ve kalın yazıda HTML, düz metin ve doğrulama metni üretir', () => {
    const request = withRichContent(body('**Özet**\n\n| Ürün | Fiyat |\n| --- | --- |\n| A | 10 |'));
    expect(request.text).toBe('Özet\n\nÜrün | Fiyat\nA | 10');
    expect(request.rich?.html).toContain('<b>Özet</b>');
    expect(request.rich?.html).toContain('<table');
    expect(request.rich?.visibleText).toBe('Özet\nÜrün | Fiyat\nA | 10');
  });

  it('kopyalamada biçimli içerik için HTML de verir', () => {
    expect(clipboardContent('- bir\n- iki')).toEqual({
      text: '- bir\n- iki',
      html: '<ul style="margin-top:0;margin-bottom:0"><li>bir</li><li>iki</li></ul>',
    });
    expect(clipboardContent('Düz metin')).toEqual({ text: 'Düz metin', html: null });
  });
});
