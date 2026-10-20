import { afterEach, describe, expect, it } from 'vitest';

import { createConnection } from './outlook-page';

/** The Fluent UI v9 provider carries colors as CSS variables; the test imitates this with an inline style. */
function fluentProvider(variables: Record<string, string>): void {
  const provider = document.createElement('div');
  provider.className = 'fui-FluentProvider';
  provider.setAttribute(
    'style',
    Object.entries(variables)
      .map(([name, value]) => `${name}: ${value}`)
      .join('; '),
  );
  document.body.append(provider);
}

describe('Outlook theme', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the dark theme and accent color from Fluent variables', () => {
    fluentProvider({
      '--colorNeutralBackground1': '#292929',
      '--colorNeutralForeground1': '#ffffff',
      '--colorBrandBackground': '#115ea3',
      '--colorBrandForeground1': '#479ef5',
    });
    const connection = createConnection();

    expect(connection.readTheme()).toEqual({
      scheme: 'dark',
      colors: { background: '#292929', text: '#ffffff', accent: '#115ea3', link: '#479ef5' },
    });
    connection.connector.dispose();
  });

  it('recognizes the light theme, and reads no theme when the background or text color is missing', () => {
    fluentProvider({
      '--colorNeutralBackground1': 'rgb(255, 255, 255)',
      '--colorNeutralForeground1': '#242424',
    });
    const light = createConnection();
    expect(light.readTheme()?.scheme).toBe('light');
    light.connector.dispose();

    document.body.innerHTML = '';
    fluentProvider({ '--colorNeutralBackground1': '#ffffff' });
    const partial = createConnection();
    expect(partial.readTheme()).toBeNull();
    partial.connector.dispose();
  });
});
