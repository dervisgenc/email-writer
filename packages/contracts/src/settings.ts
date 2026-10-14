import { z } from 'zod';

import { TONES } from './actions';
import { LANGUAGE_CODES, UI_LANGUAGES } from './languages';

/**
 * Cihazda kalıcı saklanan tercihler. E-posta, bağlam, kaynak metin, önizleme
 * ve geri alma verisi bu kayda asla eklenmez.
 */
export const SETTINGS_SCHEMA_VERSION = 1;

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Eklentinin etkinleştirilebildiği e-posta ortamları. */
export const SITE_IDS = ['outlook-web'] as const;
export type SiteId = (typeof SITE_IDS)[number];

const siteEnabledSchema = z
  .object({
    'outlook-web': z.boolean(),
  })
  .strict();

export const settingsV1Schema = z
  .object({
    schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
    revision: z.number().int().positive(),
    uiLanguage: z.enum(UI_LANGUAGES),
    targetLanguage: z.enum(LANGUAGE_CODES),
    tone: z.enum(TONES),
    theme: z.enum(THEMES),
    siteEnabled: siteEnabledSchema,
    onboardingSeen: z.boolean(),
  })
  .strict();

export type SettingsV1 = z.infer<typeof settingsV1Schema>;
export type Settings = SettingsV1;

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  revision: 1,
  uiLanguage: 'tr',
  targetLanguage: 'en',
  tone: 'neutral',
  theme: 'system',
  siteEnabled: Object.freeze({ 'outlook-web': true }),
  onboardingSeen: false,
});

/** Kullanıcının değiştirebildiği alanlar. Şema ve sürüm alanları istemciden gelmez. */
export const settingsChangesSchema = settingsV1Schema
  .pick({
    uiLanguage: true,
    targetLanguage: true,
    tone: true,
    theme: true,
    siteEnabled: true,
    onboardingSeen: true,
  })
  .partial()
  .strict();

export type SettingsChanges = z.infer<typeof settingsChangesSchema>;
