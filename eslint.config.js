import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Module boundaries are not just documented intent (see docs/DEVELOPMENT.md);
 * they are enforced here.
 */
const INTERNAL_PACKAGES = [
  '@writehand/contracts',
  '@writehand/core',
  '@writehand/ui',
  '@writehand/outlook-web',
  '@writehand/ai-openai',
  '@writehand/ai-claude-code',
  '@writehand/email-format',
];

const deepImportBan = {
  group: ['@writehand/*/src', '@writehand/*/src/**'],
  message: "Do not reach into another package's internal files; use its exported API.",
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
  // Formatting belongs to Prettier; ESLint only checks correctness and boundary rules.
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
      // Email and user text are never rendered as HTML.
      'vue/no-v-html': 'error',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'no-restricted-imports': ['error', { patterns: [deepImportBan] }],
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Never write email or user text as HTML.' },
        { property: 'outerHTML', message: 'Never write email or user text as HTML.' },
        {
          object: 'document',
          property: 'execCommand',
          message: 'Allowed only in outlook-web/writing/editor-writer.ts.',
        },
      ],
    },
  },
  {
    // contracts: environment-agnostic types and boundary schemas.
    files: ['packages/contracts/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', ...INTERNAL_PACKAGES],
            'contracts uses only zod and its own types.',
          ),
          patterns: [
            deepImportBan,
            { group: ['wxt/*'], message: 'contracts does not know about the runtime environment.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // email-format: Markdown → email HTML; pure functions free of environment and package dependencies.
    files: ['packages/email-format/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', ...INTERNAL_PACKAGES],
            'email-format uses only zod and its own types.',
          ),
          patterns: [deepImportBan],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // core: knows nothing about Vue, WXT, the browser or the Outlook page.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', 'zod', '@writehand/ui', '@writehand/outlook-web', '@writehand/core'],
            'core depends only on @writehand/contracts.',
          ),
          patterns: [
            deepImportBan,
            { group: ['wxt/*'], message: 'core does not know about the runtime environment.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...browserGlobals],
    },
  },
  {
    // ui: does not import the mail connector, business rules or browser APIs.
    files: ['packages/ui/src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['wxt', '#imports', '@writehand/outlook-web', '@writehand/core'],
            'ui only receives view data and emits events.',
          ),
          patterns: [deepImportBan, { group: ['wxt/*'], message: 'ui does not use browser helpers.' }],
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
    // The mail connector knows nothing about Vue components, business rules or the text service.
    files: ['packages/mail-connectors/**/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictImports(
            ['vue', 'wxt', '#imports', '@writehand/ui', '@writehand/core'],
            'The connector works only with contracts and the DOM.',
          ),
          patterns: [
            deepImportBan,
            { group: ['wxt/*'], message: 'The connector does not know about extension APIs.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'chrome', 'browser', 'window', 'localStorage', 'sessionStorage'],
    },
  },
  {
    // The single write path: execCommand is allowed only here.
    files: ['packages/mail-connectors/outlook-web/src/writing/editor-writer.ts'],
    rules: {
      'no-restricted-properties': ['error', { property: 'innerHTML' }, { property: 'outerHTML' }],
    },
  },
  {
    // Browser APIs in the extension are kept under platform/.
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
            ['vue', 'wxt', '#imports', '@writehand/core', '@writehand/ui', '@writehand/outlook-web'],
            'AI modules do not depend on the UI or mailbox.',
          ),
          patterns: [deepImportBan],
        },
      ],
    },
  },
  {
    // OS differences live only in the helper app's platform.ts.
    files: [
      'packages/ai-openai/src/**/*.ts',
      'packages/ai-claude-code/src/**/*.ts',
      'apps/ai-companion/src/**/*.ts',
    ],
    ignores: ['apps/ai-companion/src/platform.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['platform', 'arch'].map((property) => ({
          object: 'process',
          property,
          message: 'Define OS differences in apps/ai-companion/src/platform.ts.',
        })),
      ],
    },
  },
  {
    // Provider packages do not know each other; shared instructions and types live in contracts.
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
              '@writehand/core',
              '@writehand/ui',
              '@writehand/outlook-web',
              '@writehand/ai-openai',
              '@writehand/ai-claude-code',
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
      // Playwright fixtures declare their dependencies with an empty object pattern.
      'no-empty-pattern': 'off',
      'no-restricted-imports': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
