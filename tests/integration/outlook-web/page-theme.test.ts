import { afterEach, describe, expect, it } from 'vitest';

import { createConnection } from './outlook-page';

/** Fluent UI v9 sağlayıcısı renkleri CSS değişkeni olarak taşır; test bunu satır içi stille taklit eder. */
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

describe('Outlook teması', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('koyu temayı ve vurgu rengini Fluent değişkenlerinden okur', () => {
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

  it('açık temayı tanır; arka plan veya metin rengi yoksa tema okunmaz', () => {
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
