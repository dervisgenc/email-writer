import { z } from 'zod';

import { TONES } from './actions';
import { targetLanguageSchema, UI_LANGUAGE_PREFERENCES } from './languages';

/**
 * Cihazda kalıcı saklanan tercihler. E-posta, bağlam, kaynak metin, önizleme
 * ve geri alma verisi bu kayda asla eklenmez.
 */
export const SETTINGS_SCHEMA_VERSION = 2;

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Eklentinin etkinleştirilebildiği e-posta ortamları. */
export const SITE_IDS = ['outlook-web'] as const;
export type SiteId = (typeof SITE_IDS)[number];

/** "Çevir" menüsünde ve dil seçiminde öne çıkan diller. */
export const MAX_FAVORITE_LANGUAGES = 10;
/** Her üretime eklenen kalıcı talimatın üst sınırı. */
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
    /** Kullanıcının bütün üretimlerde uygulanmasını istediği yazım tercihi. */
    writingInstructions: z.string().max(MAX_WRITING_INSTRUCTIONS),
    tone: z.enum(TONES),
    theme: z.enum(THEMES),
    siteEnabled: siteEnabledSchema,
    onboardingSeen: z.boolean(),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

/** İlk sürüm kaydı; yalnızca okunur ve ikinci sürüme taşınır. O sürümün dilleriyle sabittir. */
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
});

/** Kullanıcının değiştirebildiği alanlar. Şema ve sürüm alanları istemciden gelmez. */
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
  })
  .partial()
  .strict();

export type SettingsChanges = z.infer<typeof settingsChangesSchema>;
