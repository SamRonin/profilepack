/**
 * Lightweight i18n runtime for ProfilePack UI surfaces.
 *
 * - Dictionaries: fa.ts (source of truth — Persian is the project's
 *                primary language) + en.ts (complementary)
 * - Resolution:  settings preference ('auto' | 'fa' | 'en'); 'auto'
 *                follows the browser UI language — English browsers get
 *                English, every other (or unknown) language gets
 *                Persian, since the project primarily targets Iranian
 *                and Persian-speaking users.
 * - RTL:         'fa' renders right-to-left; <I18nProvider> sets
 *                document lang/dir, hooks/helpers read the module
 *                singleton via translate().
 */
import { en } from './en';
import { fa, type MessageKey } from './fa';

export type { MessageKey } from './fa';
export type UiLocale = 'fa' | 'en';
export type UiLanguagePref = 'auto' | UiLocale;

const messages: Record<UiLocale, Record<MessageKey, string>> = { fa, en };

let currentLocale: UiLocale = 'fa';

/** Sets the locale used by translate() (kept in sync by <I18nProvider>). */
export function setUiLocale(locale: UiLocale): void {
  currentLocale = locale;
}

export function getUiLocale(): UiLocale {
  return currentLocale;
}

/**
 * Maps a preference + browser language to a concrete UI locale.
 * English browsers get English; Persian browsers and every other or
 * unknown language get Persian (fa) — the project's primary language.
 */
export function resolveUiLocale(pref: UiLanguagePref, browserLanguage: string): UiLocale {
  if (pref !== 'auto') return pref;
  const lang = browserLanguage.toLowerCase();
  return lang === 'en' || lang.startsWith('en-') ? 'en' : 'fa';
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
  return 'fa';
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
