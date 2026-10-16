import { describe, expect, it } from 'vitest';

import { removeOrphanedUi } from '../../../apps/browser-extension/src/mounting/orphaned-ui';

describe('Sahipsiz arayüz temizliği', () => {
  it('eklenti yeniden kurulunca eski betiğin bıraktığı araç çubuğu ve panel köklerini kaldırır; sayfanın kendi öğelerine dokunmaz', () => {
    document.body.innerHTML =
      '<div id="outlook"><div role="textbox">taslak</div></div>' +
      '<email-writer-launcher data-email-writer-ui="launcher"></email-writer-launcher>' +
      '<email-writer-launcher data-email-writer-ui="launcher"></email-writer-launcher>' +
      '<email-writer-panel data-email-writer-ui="panel"></email-writer-panel>';

    expect(removeOrphanedUi(document)).toBe(3);
    expect(document.querySelectorAll('email-writer-launcher, email-writer-panel')).toHaveLength(0);
    expect(document.querySelector('#outlook [role=textbox]')?.textContent).toBe('taslak');
    document.body.innerHTML = '';
  });
});
