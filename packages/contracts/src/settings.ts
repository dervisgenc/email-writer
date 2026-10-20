import { z } from 'zod';

import { TONES } from './actions';
import { targetLanguageSchema, UI_LANGUAGE_PREFERENCES } from './languages';

/**
 * Preferences persisted on the device. Email, context, source text, preview and undo
 * data are never added to this record.
 */
export const SETTINGS_SCHEMA_VERSION = 3;

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Email environments the extension can be enabled on. */
export const SITE_IDS = ['outlook-web'] as const;
export type SiteId = (typeof SITE_IDS)[number];

/** Maximum number of languages featured in the "Translate" menu and the language picker. */
export const MAX_FAVORITE_LANGUAGES = 10;
/** Upper limit for the standing instruction added to every generation. */
export const MAX_WRITING_INSTRUCTIONS = 1_000;

const siteEnabledSchema = z
  .object({
    'outlook-web': z.boolean(),
  })
  .strict();

const favoriteLanguagesSchema = z
  .array(targetLanguageSchema)
  .max(MAX_FAVORITE_LANGUAGES)
  .refine((languages) => new Set(languages).size === languages.length);

export const settingsSchema = z
  .object({
    schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
    revision: z.number().int().positive(),
    uiLanguage: z.enum(UI_LANGUAGE_PREFERENCES),
    targetLanguage: targetLanguageSchema,
    favoriteLanguages: favoriteLanguagesSchema,
    /** Writing preference the user wants applied to every generation. */
    writingInstructions: z.string().max(MAX_WRITING_INSTRUCTIONS),
    tone: z.enum(TONES),
    theme: z.enum(THEMES),
    siteEnabled: siteEnabledSchema,
    onboardingSeen: z.boolean(),
    /**
     * Whether to check for a new helper app version. When on, the helper app asks GitHub for
     * the latest version at most once a day (added in schema version 3).
     */
    checkHelperUpdates: z.boolean(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

/** Version 2 record: differs from version 3 only by the missing update check preference. */
export const settingsV2Schema = settingsSchema
  .omit({ checkHelperUpdates: true })
  .extend({ schemaVersion: z.literal(2) })
  .strict();

/** Version 1 record; only read and migrated to the current version. Fixed to that version's languages. */
export const settingsV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().positive(),
    uiLanguage: z.enum(['tr', 'en']),
    targetLanguage: z.enum(['tr', 'en', 'de', 'fr', 'es']),
    tone: z.enum(TONES),
    theme: z.enum(THEMES),
    siteEnabled: siteEnabledSchema,
    onboardingSeen: z.boolean(),
  })
  .strict();

export const DEFAULT_FAVORITE_LANGUAGES = Object.freeze(['en', 'tr', 'de', 'fr', 'es']);

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  revision: 1,
  uiLanguage: 'auto',
  targetLanguage: 'en',
  favoriteLanguages: [...DEFAULT_FAVORITE_LANGUAGES],
  writingInstructions: '',
  tone: 'neutral',
  theme: 'system',
  siteEnabled: Object.freeze({ 'outlook-web': true }),
  onboardingSeen: false,
  checkHelperUpdates: true,
});

/** Fields the user can change. Schema and revision fields never come from the client. */
export const settingsChangesSchema = settingsSchema
  .pick({
    uiLanguage: true,
    targetLanguage: true,
    favoriteLanguages: true,
    writingInstructions: true,
    tone: true,
    theme: true,
    siteEnabled: true,
    onboardingSeen: true,
    checkHelperUpdates: true,
  })
  .partial()
  .strict();

export type SettingsChanges = z.infer<typeof settingsChangesSchema>;
