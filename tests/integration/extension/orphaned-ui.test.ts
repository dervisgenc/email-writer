import { describe, expect, it } from 'vitest';

import { removeOrphanedUi } from '../../../apps/browser-extension/src/mounting/orphaned-ui';

describe('Orphaned UI cleanup', () => {
  it("removes the toolbar and panel roots left by the old script after the extension is reinstalled, without touching the page's own elements", () => {
    document.body.innerHTML =
      '<div id="outlook"><div role="textbox">taslak</div></div>' +
      '<writehand-launcher data-writehand-ui="launcher"></writehand-launcher>' +
      '<writehand-launcher data-writehand-ui="launcher"></writehand-launcher>' +
      '<writehand-panel data-writehand-ui="panel"></writehand-panel>';

    expect(removeOrphanedUi(document)).toBe(3);
    expect(document.querySelectorAll('writehand-launcher, writehand-panel')).toHaveLength(0);
    expect(document.querySelector('#outlook [role=textbox]')?.textContent).toBe('taslak');
    document.body.innerHTML = '';
  });
});
