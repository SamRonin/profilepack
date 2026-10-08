import { beforeEach, describe, expect, it } from 'vitest';

import { en } from '../src/shared/i18n/en';
import { fa } from '../src/shared/i18n/fa';
import { getUiLocale, resolveUiLocale, setUiLocale, translate } from '../src/shared/i18n';
import { DEFAULT_SETTINGS } from '../src/storage/types';

const TOKEN_RE = /\{(\w+)\}/g;

function tokens(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1] ?? '').sort();
}

describe('i18n dictionaries', () => {
  it('en and fa expose exactly the same keys', () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  it('no message is empty', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `en.${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(fa)) {
      expect(value.trim().length, `fa.${key}`).toBeGreaterThan(0);
    }
  });

  it('fa keeps the same interpolation tokens as en', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(tokens(fa[key]), `fa.${key}`).toEqual(tokens(en[key]));
    }
  });

  it('core Persian strings use Persian script', () => {
    const persian = /[\u0600-\u06FF]/;
    expect(fa.save).toMatch(persian);
    expect(fa.willBeFilled).toMatch(persian);
    expect(fa.privacyNote).toMatch(persian);
    // Brand names stay Latin in both locales.
    expect(fa.loading).toContain('ProfilePack');
    expect(en.loading).toContain('ProfilePack');
  });
});

describe('resolveUiLocale', () => {
  it("resolves 'auto' to fa for Persian browser languages", () => {
    expect(resolveUiLocale('auto', 'fa')).toBe('fa');
    expect(resolveUiLocale('auto', 'fa-IR')).toBe('fa');
  });

  it("resolves 'auto' to en for other or unknown browser languages", () => {
    expect(resolveUiLocale('auto', 'en-US')).toBe('en');
    expect(resolveUiLocale('auto', 'en')).toBe('en');
    expect(resolveUiLocale('auto', 'de-DE')).toBe('en');
    expect(resolveUiLocale('auto', '')).toBe('en');
  });

  it('an explicit preference always wins', () => {
    expect(resolveUiLocale('fa', 'en-US')).toBe('fa');
    expect(resolveUiLocale('en', 'fa-IR')).toBe('en');
  });
});

describe('translate', () => {
  beforeEach(() => setUiLocale('en'));

  it('returns the en message by default', () => {
    expect(getUiLocale()).toBe('en');
    expect(translate('save')).toBe(en.save);
  });

  it('returns the fa message after switching locale', () => {
    setUiLocale('fa');
    expect(translate('save')).toBe(fa.save);
    expect(translate('fillForm', { count: 2 })).toBe(fa.fillForm.replace('{count}', '2'));
  });

  it('interpolates {token} params', () => {
    expect(translate('fillForm', { count: 3 })).toBe('Fill Form (3)');
    expect(translate('templateSaved', { name: 'Checkout' })).toBe('Template saved: Checkout');
  });

  it('leaves unknown tokens untouched', () => {
    expect(translate('fillForm', { other: 'x' })).toBe('Fill Form ({count})');
  });
});

describe('settings integration', () => {
  it("defaults uiLanguage to 'auto'", () => {
    expect(DEFAULT_SETTINGS.uiLanguage).toBe('auto');
  });
});
