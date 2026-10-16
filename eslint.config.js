import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Modül sınırları (implementation_details.md §18.2) yalnızca dokümana yazılmış
 * niyet olarak bırakılmaz; burada denetlenir.
 */
const INTERNAL_PACKAGES = [
  '@email-writer/contracts',
  '@email-writer/core',
  '@email-writer/ui',
  '@email-writer/outlook-web',
  '@email-writer/ai-openai',
  '@email-writer/ai-claude-code',
  '@email-writer/email-format',
];

const deepImportBan = {
  group: ['@email-writer/*/src', '@email-writer/*/src/**'],
  message: 'Başka paketin dahili dosyalarına erişilmez; paketin dışa aktardığı arayüz kullanılır.',
};

function restrictImports(names, message) {
  return names.map((name) => ({ name, message }));
}

const browserGlobals = [
  'window',
  'document',
  'navigator',
  'chrome',
  'browser',
  'localStorage',
  'sessionStorage',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/dist/**',
      '**/coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // Biçim kararları Prettier'a aittir; ESLint yalnızca doğruluk ve sınır kurallarını denetler.
  prettier,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // E-posta ve kullanıcı metni HTML olarak çalıştırılmaz.
      'vue/no-v-html': 'error',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'no-restricted-imports': ['error', { patterns: [deepImportBan] }],
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'E-posta veya kullanıcı metni HTML olarak yazılmaz.' },
        { property: 'outerHTML', message: 'E-posta veya kullanıcı metni HTML olarak yazılmaz.' },
        {
          object: 'document',
          property: 'execCommand',
          message: 'Yalnızca outlook-web/writing/editor-writer.ts içinde kullanılabilir.',
        },
      ],
    },
  },
  {
    // contracts: ortamdan bağımsız tipler ve sınır şemaları.
    files: ['packages/contracts/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', ...INTERNAL_PACKAGES],
            'contracts yalnızca zod ve kendi tiplerini kullanır.',
          ),
          patterns: [deepImportBan, { group: ['wxt/*'], message: 'contracts çalışma ortamını bilmez.' }],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // email-format: Markdown → e-posta HTML'i; ortamdan ve diğer paketlerden bağımsız saf fonksiyonlar.
    files: ['packages/email-format/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', ...INTERNAL_PACKAGES],
            'email-format yalnızca zod ve kendi tiplerini kullanır.',
          ),
          patterns: [deepImportBan],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // core: Vue'yu, WXT'yi, tarayıcıyı ve Outlook sayfasını bilmez.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            [
              'vue',
              'wxt',
              '#imports',
              'zod',
              '@email-writer/ui',
              '@email-writer/outlook-web',
              '@email-writer/core',
            ],
            'core yalnızca @email-writer/contracts kullanır.',
          ),
          patterns: [deepImportBan, { group: ['wxt/*'], message: 'core çalışma ortamını bilmez.' }],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // ui: e-posta bağlantısını, iş kurallarını veya tarayıcı API'lerini içe aktarmaz.
    files: ['packages/ui/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['wxt', '#imports', '@email-writer/outlook-web', '@email-writer/core'],
            'ui yalnızca görünüm verisi alır ve olay yayar.',
          ),
          patterns: [deepImportBan, { group: ['wxt/*'], message: 'ui tarayıcı yardımcılarını kullanmaz.' }],
        },
      ],
      'no-restricted-globals': [
        'error',
        'chrome',
        'browser',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
      ],
    },
  },
  {
    // E-posta bağlantısı Vue bileşeni, iş kuralı veya metin işleme servisi bilmez.
    files: ['packages/mail-connectors/**/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', '@email-writer/ui', '@email-writer/core'],
            'Bağlantı modülü yalnızca contracts ve DOM ile çalışır.',
          ),
          patterns: [
            deepImportBan,
            { group: ['wxt/*'], message: "Bağlantı modülü eklenti API'lerini bilmez." },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'chrome', 'browser', 'window', 'localStorage', 'sessionStorage'],
    },
  },
  {
    // Yazma yönteminin tek yeri: execCommand yalnızca burada.
    files: ['packages/mail-connectors/outlook-web/src/writing/editor-writer.ts'],
    rules: {
      'no-restricted-properties': ['error', { property: 'innerHTML' }, { property: 'outerHTML' }],
    },
  },
  {
    // Eklentideki tarayıcı API'leri platform/ altında toplanır.
    files: [
      'apps/browser-extension/src/{controllers,composables,mounting,bootstrap,locales,development}/**/*.{ts,vue}',
    ],
    rules: {
      'no-restricted-globals': ['error', 'chrome', 'browser'],
    },
  },
  {
    files: [
      'packages/ai-openai/src/**/*.ts',
      'packages/ai-claude-code/src/**/*.ts',
      'apps/ai-companion/src/**/*.ts',
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-globals': ['error', ...browserGlobals],
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', '@email-writer/core', '@email-writer/ui', '@email-writer/outlook-web'],
            'AI modules do not depend on the UI or mailbox.',
          ),
          patterns: [deepImportBan],
        },
      ],
    },
  },
  {
    // Sağlayıcı paketleri birbirini bilmez; ortak talimat ve tipler contracts'tadır.
    files: ['packages/ai-openai/src/**/*.ts', 'packages/ai-claude-code/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            [
              'vue',
              'wxt',
              '#imports',
              '@email-writer/core',
              '@email-writer/ui',
              '@email-writer/outlook-web',
              '@email-writer/ai-openai',
              '@email-writer/ai-claude-code',
            ],
            'AI provider packages depend only on contracts.',
          ),
          patterns: [deepImportBan],
        },
      ],
    },
  },
  {
    files: [
      'tests/**/*.{ts,mjs}',
      'scripts/**/*.{js,mjs}',
      'apps/ai-companion/scripts/*.mjs',
      '*.config.{js,ts}',
      'apps/browser-extension/*.config.ts',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-console': 'off',
      // Playwright fixture'ları bağımlılık listesini boş nesne kalıbıyla bildirir.
      'no-empty-pattern': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
