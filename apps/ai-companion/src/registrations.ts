import { readFile } from 'node:fs/promises';
import { HOST_BROWSERS, NATIVE_HOST_NAME, type HostBrowser } from '@email-writer/contracts';

import type { HostPlatform } from './platform';

/** The host manifest a browser reads, if it belongs to this helper. */
export interface HostManifest {
  /** The program the browser starts. */
  readonly path: string;
  /** Extension IDs (Firefox) or origins (Chromium) allowed to connect. */
  readonly allowed: readonly string[];
}

export function parseHostManifest(text: string): HostManifest | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return null;
    const { name, path, allowed_extensions, allowed_origins } = value as Record<string, unknown>;
    const allowed = allowed_extensions ?? allowed_origins;
    if (name !== NATIVE_HOST_NAME || typeof path !== 'string' || !Array.isArray(allowed)) return null;
    return { path, allowed: allowed.filter((item): item is string => typeof item === 'string') };
  } catch {
    return null;
  }
}

/** Reads what one browser currently finds for this helper; null when it finds nothing of ours. */
export async function readRegistration(
  platform: HostPlatform,
  browser: HostBrowser,
): Promise<HostManifest | null> {
  const { manifest, registryKey } = platform.registration(browser);
  // On Windows the browser follows the registry value, not the file location.
  if (registryKey !== null && (await platform.registry?.read(registryKey)) !== manifest) return null;
  const text = await readFile(manifest, 'utf8').catch(() => null);
  return text === null ? null : parseHostManifest(text);
}

/** Browsers whose registration starts this installation. */
export async function registeredBrowsers(platform: HostPlatform, program: string): Promise<HostBrowser[]> {
  const registrations = await Promise.all(
    HOST_BROWSERS.map(async (browser) => ({ browser, manifest: await readRegistration(platform, browser) })),
  );
  return registrations.filter(({ manifest }) => manifest?.path === program).map(({ browser }) => browser);
}
