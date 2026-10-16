import { LanguagePicker, languageLabel, matchLanguage, provideUiText } from '@email-writer/ui';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref, type Component } from 'vue';

import { tr } from '../../../apps/browser-extension/src/locales/tr';

describe('Dil adları ve eşleme', () => {
  it('arayüz dilindeki adı, İngilizce adı ve kodu katalog koduna çevirir', () => {
    expect(matchLanguage('Almanca', 'tr')).toBe('de');
    expect(matchLanguage('german', 'tr')).toBe('de');
    expect(matchLanguage('brezilya portekizcesi', 'tr')).toBe('pt-BR');
    expect(matchLanguage('ja', 'en')).toBe('ja');
    expect(matchLanguage('Kurmancî', 'tr')).toBe('Kurmancî');
    expect(languageLabel('zh-Hans', 'tr')).toBe('Basitleştirilmiş Çince');
    expect(languageLabel('Kurmancî', 'tr')).toBe('Kurmancî');
  });
});

function picker(props: Record<string, unknown>) {
  const emitted: unknown[] = [];
  const Host = defineComponent({
    setup() {
      provideUiText(ref(tr.ui));
      return () =>
        h(LanguagePicker as Component, {
          ...props,
          'onUpdate:modelValue': (value: unknown) => emitted.push(value),
          onSubmit: () => emitted.push('submit'),
        });
    },
  });
  return { wrapper: mount(Host), emitted };
}

describe('LanguagePicker', () => {
  it('yazılan veya listeden seçilen dili koda çevirip yayar; geçersiz girdide son değere döner', async () => {
    const { wrapper, emitted } = picker({ modelValue: 'en' });
    const input = wrapper.get('input');
    expect((input.element as HTMLInputElement).value).toBe('İngilizce');

    await input.setValue('Japonca');
    await input.trigger('keydown', { key: 'Enter' });
    expect(emitted).toEqual(['ja', 'submit']);

    await input.setValue('a<b');
    await input.trigger('blur');
    expect((input.element as HTMLInputElement).value).toBe('Japonca');
    expect(emitted).toEqual(['ja', 'submit']);
    wrapper.unmount();
  });

  it('ekleme alanı onaylanınca temizlenir ve eklenmiş dilleri önermez', async () => {
    const { wrapper, emitted } = picker({ modelValue: null, clearOnCommit: true, exclude: ['de'] });
    const options = wrapper.findAll('option').map((option) => option.attributes('value'));
    expect(options).not.toContain('Almanca');
    expect(options).toContain('İtalyanca');

    const input = wrapper.get('input');
    await input.setValue('Kurmancî');
    await input.trigger('keydown', { key: 'Enter' });
    expect(emitted).toEqual(['Kurmancî', 'submit']);
    expect((input.element as HTMLInputElement).value).toBe('');
    wrapper.unmount();
  });
});
