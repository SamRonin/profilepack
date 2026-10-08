import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import {
  browserUiLanguage,
  resolveUiLocale,
  setUiLocale,
  translate,
  type UiLanguagePref,
  type UiLocale,
} from './index';

export type TextDirection = 'ltr' | 'rtl';

interface I18nContextValue {
  locale: UiLocale;
  dir: TextDirection;
  t: typeof translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provides { locale, dir, t } to the React tree and keeps the document
 * element's lang/dir in sync (Persian renders right-to-left). Also
 * syncs the module-level locale for non-React consumers.
 */
export function I18nProvider({
  preferred,
  children,
}: {
  preferred: UiLanguagePref;
  children: ReactNode;
}): ReactNode {
  const locale = useMemo(() => resolveUiLocale(preferred, browserUiLanguage()), [preferred]);
  const dir: TextDirection = locale === 'fa' ? 'rtl' : 'ltr';

  // Idempotent: keeps translate() correct for hooks that build strings
  // outside the React tree (usePageScan errors, status messages, …).
  setUiLocale(locale);

  useEffect(() => {
    setUiLocale(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo<I18nContextValue>(() => ({ locale, dir, t: translate }), [locale, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
