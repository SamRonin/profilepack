import { describe, expect, it } from 'vitest';

import {
  detectDateStyleFromHint,
  formatDate,
  formatDateOfBirth,
  localeDateStyle,
} from '../src/domain/dateFormat';

describe('date formatting', () => {
  const iso = '1994-06-14';

  it('formats per locale defaults', () => {
    expect(formatDateOfBirth(iso, 'de-DE')).toBe('14.06.1994');
    expect(formatDateOfBirth(iso, 'en-US')).toBe('06/14/1994');
    expect(formatDateOfBirth(iso, 'en-GB')).toBe('14/06/1994');
    expect(formatDateOfBirth(iso, 'ja-JP')).toBe('1994/06/14');
  });

  it('falls back to ISO for unknown locales', () => {
    expect(formatDateOfBirth(iso, 'zz-ZZ')).toBe('1994-06-14');
  });

  it('placeholder hints override the locale', () => {
    expect(formatDateOfBirth(iso, 'de-DE', 'MM/DD/YYYY')).toBe('06/14/1994');
    expect(formatDateOfBirth(iso, 'en-US', 'DD.MM.YYYY')).toBe('14.06.1994');
    expect(formatDateOfBirth(iso, 'en-GB', 'JJJJ-MM-TT')).toBe('1994/06/14');
  });

  it('detects hint styles', () => {
    expect(detectDateStyleFromHint('DD.MM.YYYY')).toBe('dmy-dot');
    expect(detectDateStyleFromHint('TT.MM.JJJJ')).toBe('dmy-dot');
    expect(detectDateStyleFromHint('MM/DD/YYYY')).toBe('mdy-slash');
    expect(detectDateStyleFromHint('YYYY/MM/DD')).toBe('ymd-slash');
    expect(detectDateStyleFromHint('JJJJ-MM-TT')).toBe('ymd-slash');
    expect(detectDateStyleFromHint('no hint here')).toBeNull();
    expect(detectDateStyleFromHint(null)).toBeNull();
  });

  it('formats explicitly by style', () => {
    expect(formatDate(iso, 'dmy-dot')).toBe('14.06.1994');
    expect(formatDate(iso, 'dmy-slash')).toBe('14/06/1994');
    expect(formatDate(iso, 'mdy-slash')).toBe('06/14/1994');
    expect(formatDate(iso, 'ymd-slash')).toBe('1994/06/14');
    expect(formatDate(iso, 'iso')).toBe('1994-06-14');
    expect(formatDate('not-a-date', 'iso')).toBe('not-a-date');
  });

  it('maps locales to styles', () => {
    expect(localeDateStyle('de-AT')).toBe('dmy-dot');
    expect(localeDateStyle('ja-JP')).toBe('ymd-slash');
    expect(localeDateStyle('en-US')).toBe('mdy-slash');
    expect(localeDateStyle('en-GB')).toBe('dmy-slash');
  });
});
