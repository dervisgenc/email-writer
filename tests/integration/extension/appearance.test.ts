import { describe, expect, it } from 'vitest';

import { resolveAppearance } from '../../../apps/browser-extension/src/mounting/appearance';

describe('extension appearance', () => {
  const outlookDark = {
    scheme: 'dark' as const,
    colors: { background: '#292929', text: '#ffffff', accent: '#115ea3' },
  };

  it('uses the Outlook theme colors and light/dark mode when set to "automatic"', () => {
    expect(resolveAppearance('system', outlookDark)).toEqual({
      theme: 'dark',
      style: { '--ew-color-bg': '#292929', '--ew-color-text': '#ffffff', '--ew-color-accent': '#115ea3' },
    });
  });

  it('falls back to the system preference when the Outlook theme cannot be read, and follows an explicit light/dark choice', () => {
    expect(resolveAppearance('system', null)).toEqual({ theme: 'system', style: {} });
    expect(resolveAppearance('light', outlookDark)).toEqual({ theme: 'light', style: {} });
  });
});
