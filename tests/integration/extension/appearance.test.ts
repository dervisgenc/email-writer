import { describe, expect, it } from 'vitest';

import { resolveAppearance } from '../../../apps/browser-extension/src/mounting/appearance';

describe('eklenti görünümü', () => {
  const outlookDark = {
    scheme: 'dark' as const,
    colors: { background: '#292929', text: '#ffffff', accent: '#115ea3' },
  };

  it('"otomatik" ayarında Outlook temasının renklerini ve açık/koyu modunu kullanır', () => {
    expect(resolveAppearance('system', outlookDark)).toEqual({
      theme: 'dark',
      style: { '--ew-color-bg': '#292929', '--ew-color-text': '#ffffff', '--ew-color-accent': '#115ea3' },
    });
  });

  it('Outlook teması okunamazsa sistem tercihine, açık/koyu seçimi varsa ona uyar', () => {
    expect(resolveAppearance('system', null)).toEqual({ theme: 'system', style: {} });
    expect(resolveAppearance('light', outlookDark)).toEqual({ theme: 'light', style: {} });
  });
});
