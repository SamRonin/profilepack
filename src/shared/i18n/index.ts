/**
 * Lightweight i18n runtime for ProfilePack UI surfaces.
 *
 * - Dictionaries: en.ts (source of truth) + fa.ts
 * - Resolution:  settings preference ('auto' | 'en' | 'fa'); 'auto'
 *                follows the browser UI language.
 * - RTL:         'fa' renders right-to-left; <I18nProvider> sets
 *                document lang/dir, hooks/helpers read the module
 *                singleton via translate().
 */
import { en, type MessageKey } from './en';
import { fa } from './fa';

export type { MessageKey } from './en';
export type UiLocale = 'en' | 'fa';
export type UiLanguagePref = 'auto' | UiLocale;

const messages: Record<UiLocale, Record<MessageKey, string>> = { en, fa };

let currentLocale: UiLocale = 'en';

/** Sets the locale used by translate() (kept in sync by <I18nProvider>). */
export function setUiLocale(locale: UiLocale): void {
  currentLocale = locale;
}

export function getUiLocale(): UiLocale {
  return currentLocale;
}

/**
 * Maps a preference + browser language to a concrete UI locale.
 * Unknown/absent browser languages resolve to English.
 */
export function resolveUiLocale(pref: UiLanguagePref, browserLanguage: string): UiLocale {
  if (pref !== 'auto') return pref;
  const lang = browserLanguage.toLowerCase();
  return lang === 'fa' || lang.startsWith('fa-') ? 'fa' : 'en';
}

/** Browser UI language, extension-aware (chrome.i18n) with DOM fallback. */
export function browserUiLanguage(): string {
  if (
    typeof chrome !== 'undefined' &&
    chrome.i18n &&
    typeof chrome.i18n.getUILanguage === 'function'
  ) {
    try {
      return chrome.i18n.getUILanguage();
    } catch {
      // fall through to navigator
    }
  }
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/**
 * Translates `key` in the current locale. Non-React consumers (hooks,
 * helpers) use this directly; React components should prefer useI18n().
 */
export function translate(key: MessageKey, params?: Record<string, string | number>): string {
  return interpolate(messages[currentLocale][key], params);
}
