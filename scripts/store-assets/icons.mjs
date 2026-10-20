// Generates the extension and store icons from the SVGs under assets/brand/. Sizes of
// 32 px and below use the small variant with thicker strokes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { ROOT, STORE_DIR } from './harness.mjs';

const BRAND = resolve(ROOT, 'assets/brand');
const EXTENSION_ICONS = resolve(ROOT, 'apps/browser-extension/public/icon');

/** Padding: the Chrome Web Store wants a 96 px drawing with a 16 px transparent border in its 128 px icon. */
const OUTPUTS = [
  ...[16, 32, 48, 64, 96, 128].map((size) => ({
    path: resolve(EXTENSION_ICONS, `${size}.png`),
    size,
    padding: 0,
  })),
  { path: resolve(STORE_DIR, 'icons/chrome-store-icon-128.png'), size: 128, padding: 16 },
  { path: resolve(STORE_DIR, 'icons/edge-store-logo-300.png'), size: 300, padding: 0 },
  { path: resolve(STORE_DIR, 'icons/writehand-icon-512.png'), size: 512, padding: 0 },
];

export async function iconDataUri(variant = 'writehand-icon') {
  const svg = await readFile(resolve(BRAND, `${variant}.svg`));
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
}

export async function renderIcons(browser) {
  const sources = { large: await iconDataUri(), small: await iconDataUri('writehand-icon-small') };
  const page = await browser.newPage();
  for (const { path, size, padding } of OUTPUTS) {
    await page.setViewportSize({ width: size, height: size });
    const source = size <= 32 ? sources.small : sources.large;
    await page.setContent(
      `<body style="margin:0;background:transparent"><img src="${source}" style="display:block;margin:${padding}px;width:${size - 2 * padding}px;height:${size - 2 * padding}px"></body>`,
    );
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, await page.screenshot({ omitBackground: true }));
  }
  await page.close();
  return OUTPUTS.map((output) => output.path);
}
