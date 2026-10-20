import type { HostInfo } from '@writehand/contracts';

/** What the extension knows about the helper app on this computer. */
export type HelperView =
  | { readonly kind: 'checking' }
  /** The browser has not yet allowed the extension to talk to programs on this computer. */
  | { readonly kind: 'permission' }
  | { readonly kind: 'missing' }
  /** Older than this extension supports; `version` is null when it is too old to report one. */
  | { readonly kind: 'outdated'; readonly version: string | null }
  | { readonly kind: 'connected'; readonly info: HostInfo };

/** Text shared by the helper app card and the wizard's install step. */
export interface HelperText {
  readonly title: string;
  readonly description: string;
  /** Short status shown at the top of the card. */
  readonly states: Readonly<Record<HelperView['kind'], string>>;
  readonly permissionBody: string;
  readonly grant: string;
  readonly missingBody: string;
  readonly outdatedBody: string;
  readonly version: (version: string, system: string) => string;
  readonly browsers: (names: string) => string;
  readonly development: string;
  readonly checkUpdates: string;
  readonly checkUpdatesHint: string;
  readonly updateAvailable: (version: string) => string;
  readonly upToDate: string;
  readonly update: string;
  readonly updating: string;
  readonly updated: (version: string) => string;
  readonly openWizard: string;
  readonly uninstallTitle: string;
  /** Explains the uninstall command; `flag` is the option that also deletes account data. */
  readonly uninstallBody: (flag: string) => string;
  readonly copy: string;
  readonly copied: string;
}
