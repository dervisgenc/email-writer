// Üretim paketlerinin derleme sonrası kontrolü (implementation_details.md §16.2–16.3):
// izinler dar mı, yerel test adresleri ve geliştirme modülü normal pakete
// sızmış mı, arka plan biçimi tarayıcıya uygun mu, Firefox kimliği ve veri
// paylaşımı beyanı var mı?
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputs = {
  chrome: resolve(root, 'apps/browser-extension/.output/chrome-mv3'),
  firefox: resolve(root, 'apps/browser-extension/.output/firefox-mv3'),
};

const ALLOWED_PERMISSIONS = ['nativeMessaging', 'storage'];
const FORBIDDEN_PERMISSIONS = [
  '<all_urls>',
  'tabs',
  'scripting',
  'activeTab',
  'cookies',
  'webRequest',
  'webRequestBlocking',
  'downloads',
  'clipboardRead',
  'history',
  'bookmarks',
];
const SUPPORTED_MATCHES = [
  'https://outlook.live.com/*',
  'https://outlook.office.com/*',
  'https://outlook.office365.com/*',
  'https://outlook.cloud.microsoft/*',
];
const DEVELOPMENT_MARKERS = ['email-writer-development-fixture', 'localhost', '127.0.0.1'];

const problems = [];
const fail = (browser, message) => problems.push(`[${browser}] ${message}`);

function filesIn(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

for (const [browser, directory] of Object.entries(outputs)) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
  } catch {
    fail(browser, `manifest okunamadı: ${directory} (önce "pnpm build" çalıştırın)`);
    continue;
  }

  if (manifest.manifest_version !== 3) fail(browser, 'Manifest V3 değil.');

  const permissions = manifest.permissions ?? [];
  if (JSON.stringify([...permissions].sort()) !== JSON.stringify(ALLOWED_PERMISSIONS)) {
    fail(browser, `beklenmeyen izinler: ${JSON.stringify(permissions)}`);
  }
  const allPermissions = [
    ...permissions,
    ...(manifest.optional_permissions ?? []),
    ...(manifest.host_permissions ?? []),
    ...(manifest.optional_host_permissions ?? []),
  ];
  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    if (allPermissions.includes(forbidden)) fail(browser, `yasak izin: ${forbidden}`);
  }
  if ((manifest.host_permissions ?? []).length > 0) {
    fail(browser, `geniş host_permissions eklenmemeli: ${JSON.stringify(manifest.host_permissions)}`);
  }

  for (const script of manifest.content_scripts ?? []) {
    for (const pattern of script.matches ?? []) {
      if (!SUPPORTED_MATCHES.includes(pattern))
        fail(browser, `desteklenmeyen content script eşleşmesi: ${pattern}`);
    }
    if (script.all_frames === true) fail(browser, 'all_frames başlangıçta kapalı olmalı.');
  }
  for (const resource of manifest.web_accessible_resources ?? []) {
    for (const pattern of resource.matches ?? []) {
      if (!SUPPORTED_MATCHES.includes(pattern))
        fail(browser, `web_accessible_resources eşleşmesi: ${pattern}`);
    }
  }

  const csp = JSON.stringify(manifest.content_security_policy ?? '');
  if (csp.includes('unsafe-eval') || csp.includes('http')) fail(browser, `gevşetilmiş CSP: ${csp}`);

  if (browser === 'chrome' && typeof manifest.background?.service_worker !== 'string') {
    fail(browser, 'Chromium paketinde arka plan service worker olmalı.');
  }
  if (browser === 'firefox') {
    if (!Array.isArray(manifest.background?.scripts))
      fail(browser, 'Firefox paketinde arka plan background.scripts olmalı.');
    const gecko = manifest.browser_specific_settings?.gecko;
    if (typeof gecko?.id !== 'string') fail(browser, 'browser_specific_settings.gecko.id eksik.');
    if (gecko?.data_collection_permissions === undefined)
      fail(browser, 'Firefox veri paylaşımı beyanı eksik.');
  }

  for (const file of filesIn(directory)) {
    if (!/\.(js|html|json|css)$/.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    for (const marker of DEVELOPMENT_MARKERS) {
      if (content.includes(marker))
        fail(browser, `geliştirme işareti "${marker}" normal pakette: ${file.slice(directory.length + 1)}`);
    }
    if (/<script[^>]+src=["']https?:/i.test(content)) fail(browser, `uzaktan kod yükleme: ${file}`);
  }
}

if (problems.length > 0) {
  console.error('Paket kontrolü BAŞARISIZ:\n' + problems.map((problem) => `  - ${problem}`).join('\n'));
  process.exit(1);
}
console.log(
  'Paket kontrolü geçti: chrome-mv3 ve firefox-mv3 (izinler, eşleşmeler, arka plan biçimi, geliştirme kodu).',
);
