import { describe, expect, it } from 'vitest';

import {
  generatePersona,
  generatePersonaData,
  mulberry32,
  transliterate,
} from '../src/domain/generator';
import { PRESETS, PRESET_IDS } from '../src/domain/generatorData';

describe('synthetic persona generation', () => {
  it('is deterministic for the same seed', () => {
    const a = generatePersonaData('de', 42);
    const b = generatePersonaData('de', 42);
    expect(a).toEqual(b);
  });

  it('differs between seeds', () => {
    const a = generatePersonaData('de', 1);
    const b = generatePersonaData('de', 2);
    expect(a).not.toEqual(b);
  });

  it('derives email and username from the name (consistency invariant)', () => {
    for (const presetId of PRESET_IDS) {
      const data = generatePersonaData(presetId, 7);
      const first = transliterate(data.identity.firstName);
      const last = transliterate(data.identity.lastName);
      expect(data.contact.email).toBe(`${first}.${last}@example.test`);
      expect(data.identity.username).toBe(`${first}-${last}`);
      expect(data.identity.fullName).toContain(data.identity.firstName);
      expect(data.identity.fullName).toContain(data.identity.lastName);
    }
  });

  it('always uses reserved/fictional email domains', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const presetId of PRESET_IDS) {
        const email = generatePersonaData(presetId, seed).contact.email;
        expect(email).toMatch(/@(example\.test|example\.com|example\.org)$/);
      }
    }
  });

  it('uses fictional US phone ranges (555-01XX)', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(generatePersonaData('us', seed).contact.phone).toMatch(/^\+1 \(\d{3}\) 555-01\d{2}$/);
    }
  });

  it('uses fictional UK phone ranges (01632 960XXX)', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(generatePersonaData('uk', seed).contact.phone).toMatch(/^\+44 1632 960\d{2}$/);
    }
  });

  it('produces locale-plausible postal codes', () => {
    expect(generatePersonaData('de', 3).address.postalCode).toMatch(/^\d{5}$/);
    expect(generatePersonaData('jp', 3).address.postalCode).toMatch(/^\d{3}-\d{4}$/);
    expect(generatePersonaData('us', 3).address.postalCode).toMatch(/^\d{5}$/);
    expect(generatePersonaData('uk', 3).address.postalCode).toMatch(/^[A-Z]\d{1,2} \d[A-Z]{2}$/);
  });

  it('produces a valid ISO date of birth in range', () => {
    const dob = generatePersonaData('de', 5).identity.dateOfBirth;
    expect(dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const year = Number(dob.slice(0, 4));
    expect(year).toBeGreaterThanOrEqual(1960);
    expect(year).toBeLessThanOrEqual(2004);
  });

  it('exposes four extendable presets with locale + country', () => {
    expect(PRESET_IDS).toEqual(['de', 'us', 'uk', 'jp']);
    for (const id of PRESET_IDS) {
      expect(PRESETS[id].meta.locale).toBeTruthy();
      expect(PRESETS[id].meta.country).toBeTruthy();
      const persona = generatePersona(id, { seed: 11 });
      expect(persona.country).toBe(PRESETS[id].meta.country);
      expect(persona.locale).toBe(PRESETS[id].meta.locale);
    }
  });

  it('PRNG is stable', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
});
