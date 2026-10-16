import { UI_LANGUAGES } from '@email-writer/contracts';
import { describe, expect, it } from 'vitest';

import { textFor, uiLanguageFor } from '../../../apps/browser-extension/src/locales';
import { countWith } from '../../../apps/browser-extension/src/locales/plural';

/** Metin ağacındaki düz metinler, yollarıyla (işlev olan metinler hariç). */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key));
}

describe('Arayüz dilleri', () => {
  it('"Otomatik" tarayıcının desteklenen ilk dilini seçer; desteklenmeyen dilde İngilizce', () => {
    expect(uiLanguageFor('auto', ['de-AT', 'en-US'])).toBe('de');
    expect(uiLanguageFor('auto', ['fr-CA'])).toBe('fr');
    expect(uiLanguageFor('auto', ['es-419'])).toBe('es');
    expect(uiLanguageFor('auto', ['pt-BR'])).toBe('en');
  });

  it.each(UI_LANGUAGES)('%s: dil kodu doğru, boş metin yok', (language) => {
    const text = textFor(language);

    expect(text.ui.locale).toBe(language);
    for (const [path, value] of strings(text)) {
      expect(value.trim(), path).not.toBe('');
    }
  });

  it.each(UI_LANGUAGES.filter((language) => language !== 'en'))(
    '%s: İngilizce cümle çevrilmeden kalmamış',
    (language) => {
      const english = new Map(strings(textFor('en')));
      // Kısa metinler (ör. "Neutral", ürün adları) dillerde aynı olabilir; cümleler olamaz.
      const untranslated = strings(textFor(language))
        .filter(([path, value]) => value.length > 30 && english.get(path) === value)
        .map(([path]) => path);

      expect(untranslated).toEqual([]);
    },
  );

  it('sayıyı dilin çoğul kuralıyla yazar', () => {
    expect(countWith('en')(0, 'message', 'messages')).toBe('0 messages');
    expect(countWith('fr')(0, 'message', 'messages')).toBe('0 message');
    expect(countWith('de')(1, 'Nachricht', 'Nachrichten')).toBe('1 Nachricht');
    expect(countWith('es')(2, 'mensaje', 'mensajes')).toBe('2 mensajes');
  });
});
