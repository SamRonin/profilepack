import { describe, expect, it } from 'vitest';

import { classifyField, tokenize } from '../src/domain/classification/classifier';
import type { FieldInput } from '../src/domain/classification/types';

function classify(overrides: Partial<FieldInput>): ReturnType<typeof classifyField> {
  return classifyField({ tag: 'input', ...overrides });
}

describe('field classification (required mappings)', () => {
  it('maps first_name -> firstName', () => {
    expect(classify({ name: 'first_name' }).field).toBe('firstName');
  });

  it('maps fname -> firstName', () => {
    expect(classify({ id: 'fname' }).field).toBe('firstName');
  });

  it('maps email -> email', () => {
    expect(classify({ name: 'email' }).field).toBe('email');
  });

  it('maps billing_zip -> postalCode', () => {
    const result = classify({ name: 'billing_zip' });
    expect(result.field).toBe('postalCode');
    expect(result.needsReview).toBe(false);
  });

  it('maps company -> company', () => {
    expect(classify({ name: 'company' }).field).toBe('company');
  });

  it('maps phone_number -> phone', () => {
    expect(classify({ name: 'phone_number' }).field).toBe('phone');
  });
});

describe('field classification (language support)', () => {
  it('maps German labels: Vorname -> firstName', () => {
    expect(classify({ label: 'Vorname' }).field).toBe('firstName');
  });

  it('maps German labels: Nachname -> lastName', () => {
    expect(classify({ label: 'Nachname' }).field).toBe('lastName');
  });

  it('maps German labels: PLZ -> postalCode', () => {
    expect(classify({ name: 'plz' }).field).toBe('postalCode');
  });

  it('maps German labels: Geburtsdatum -> dateOfBirth', () => {
    expect(classify({ label: 'Geburtsdatum' }).field).toBe('dateOfBirth');
  });

  it('maps USt-IdNr. -> vatId', () => {
    expect(classify({ name: 'umsatzsteuer_id', label: 'USt-IdNr.' }).field).toBe('vatId');
  });

  it('maps Straße und Hausnummer -> addressLine1', () => {
    expect(classify({ label: 'Straße und Hausnummer' }).field).toBe('addressLine1');
  });

  it('maps strasse_hausnummer (attribute style) -> addressLine1', () => {
    expect(classify({ name: 'strasse_hausnummer' }).field).toBe('addressLine1');
  });
});

describe('field classification (Persian)', () => {
  it('maps Persian identity labels', () => {
    expect(classify({ label: 'نام' }).field).toBe('firstName');
    expect(classify({ label: 'نام خانوادگی' }).field).toBe('lastName');
    expect(classify({ label: 'نام و نام خانوادگی' }).field).toBe('fullName');
    expect(classify({ label: 'نام کاربری' }).field).toBe('username');
  });

  it('maps Persian contact labels', () => {
    expect(classify({ label: 'ایمیل' }).field).toBe('email');
    expect(classify({ label: 'شماره موبایل' }).field).toBe('phone');
    expect(classify({ label: 'شماره همراه' }).field).toBe('phone');
    expect(classify({ label: 'تلفن همراه' }).field).toBe('phone');
  });

  it('maps Persian address labels', () => {
    expect(classify({ label: 'کد پستی' }).field).toBe('postalCode');
    expect(classify({ label: 'کدپستی' }).field).toBe('postalCode');
    expect(classify({ label: 'نشانی' }).field).toBe('addressLine1');
    expect(classify({ label: 'آدرس' }).field).toBe('addressLine1');
    expect(classify({ label: 'استان' }).field).toBe('state');
    expect(classify({ label: 'شهر' }).field).toBe('city');
    expect(classify({ label: 'خیابان' }).field).toBe('street');
  });

  it('never fills Persian sensitive fields (national ID is the SSN equivalent)', () => {
    expect(classify({ label: 'کد ملی' }).field).toBe('neverFill');
    expect(classify({ label: 'کدملی' }).field).toBe('neverFill');
    expect(classify({ label: 'رمز عبور' }).field).toBe('neverFill');
    expect(classify({ label: 'شماره کارت' }).field).toBe('neverFill');
  });

  it('normalizes ZWNJ (نیم‌فاصله) and Arabic letter variants', () => {
    expect(classify({ label: 'نام\u200Cخانوادگی' }).field).toBe('lastName');
    expect(classify({ label: 'کد\u200Cپستی' }).field).toBe('postalCode');
    // Arabic yeh (ي) folds to Persian yeh (ی)
    expect(classify({ label: 'نام خانوادگي' }).field).toBe('lastName');
  });

  it('prefers the most specific Persian term within one signal', () => {
    // «نام کاربری» must resolve to username, not fall back to firstName (نام).
    const result = classify({ label: 'نام کاربری' });
    expect(result.field).toBe('username');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

describe('field classification (signals)', () => {
  it('uses autocomplete tokens including section prefixes', () => {
    expect(classify({ autocomplete: 'given-name' }).field).toBe('firstName');
    expect(classify({ autocomplete: 'billing postal-code' }).field).toBe('postalCode');
  });

  it('uses input type as a signal', () => {
    expect(classify({ inputType: 'email', name: 'mail_field' }).field).toBe('email');
    expect(classify({ inputType: 'tel' }).field).toBe('phone');
  });

  it('uses aria-label', () => {
    expect(classify({ ariaLabel: 'Company name' }).field).toBe('company');
  });

  it('treats camelCase names like separated words', () => {
    expect(classify({ name: 'billingFirstName' }).field).toBe('firstName');
  });

  it('maps camelCase firstName attribute', () => {
    expect(classify({ name: 'firstName' }).field).toBe('firstName');
  });
});

describe('field classification (safety)', () => {
  it('never fills password fields', () => {
    const result = classify({ name: 'password', inputType: 'password' });
    expect(result.field).toBe('neverFill');
  });

  it('never fills consent/newsletter checkboxes', () => {
    expect(classify({ name: 'newsletter_optin' }).field).toBe('neverFill');
    expect(classify({ label: 'I agree to the terms' }).field).toBe('neverFill');
  });

  it('never fills payment fields', () => {
    expect(classify({ name: 'card_number' }).field).toBe('neverFill');
    expect(classify({ autocomplete: 'cc-csc' }).field).toBe('neverFill');
  });

  it('marks unrecognizable fields as unknown', () => {
    const result = classify({ name: 'customer_ref' });
    expect(result.field).toBe('unknown');
    expect(result.needsReview).toBe(true);
  });
});

describe('tokenizer', () => {
  it('normalizes umlauts and separators', () => {
    expect(tokenize('Straße')).toEqual(['strasse']);
    expect(tokenize('billing-postal-code')).toEqual(['billing', 'postal', 'code']);
    expect(tokenize('addressLine1')).toEqual(['address', 'line', '1']);
  });

  it('keeps Persian tokens, folds ZWNJ and Persian digits', () => {
    expect(tokenize('نام خانوادگی')).toEqual(['نام', 'خانوادگی']);
    expect(tokenize('کد\u200Cپستی')).toEqual(['کد', 'پستی']);
    expect(tokenize('کدپستی ۱۲۳')).toEqual(['کدپستی', '123']);
    // Latin + Persian mixed tokens stay separated.
    expect(tokenize('userنام')).toEqual(['user', 'نام']);
  });
});
