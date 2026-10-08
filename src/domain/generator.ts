import { createId } from '../shared/id';
import { getPersonaValue, PROFILE_FIELDS, type ProfileField } from './fields';
import { PRESETS, type PresetId } from './generatorData';
import type { Persona, PersonaData } from './persona';

/**
 * Small deterministic PRNG (mulberry32). Given the same seed, the whole
 * persona is reproducible: names, email, username, address and phone
 * are all derived from this single source — never independently random.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  const index = Math.floor(rng() * list.length);
  return list[index] as T;
}

function digits(rng: () => number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += Math.floor(rng() * 10).toString();
  return out;
}

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

const TRANSLIT: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
};

/** ASCII-safe transliteration for email/username derivation (ü -> ue). */
export function transliterate(value: string): string {
  return value
    .replace(/[äöüßÄÖÜ]/g, (c) => TRANSLIT[c] ?? c)
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();
}

export interface GenerateOptions {
  /** Omit to create a one-off random persona; provide for reproducibility. */
  seed?: number;
}

export function generatePersonaData(presetId: PresetId, seed: number): PersonaData {
  const preset = PRESETS[presetId];
  const rng = mulberry32(seed);

  const firstName = pick(rng, preset.firstNames);
  const lastName = pick(rng, preset.lastNames);
  const middleName = preset.middleNames && rng() < 0.4 ? pick(rng, preset.middleNames) : undefined;

  const city = pick(rng, preset.cities);
  const streetName = pick(rng, preset.streets);

  // Street formats stay locale-specific.
  let street: string;
  let addressLine1: string;
  if (presetId === 'de') {
    const houseNumber = 1 + Math.floor(rng() * 99);
    street = `${streetName} ${houseNumber}`;
    addressLine1 = street;
  } else if (presetId === 'jp') {
    street = `${1 + Math.floor(rng() * 8)}-${1 + Math.floor(rng() * 8)}-${1 + Math.floor(rng() * 8)} ${streetName}`;
    addressLine1 = street;
  } else {
    const houseNumber = 1 + Math.floor(rng() * 999);
    street = `${houseNumber} ${streetName}`;
    addressLine1 = street;
  }

  const addressLine2 =
    preset.addressLine2Samples && rng() < 0.3 ? pick(rng, preset.addressLine2Samples) : undefined;

  // Phones use reserved/fictional number ranges where they exist:
  // US: +1 (XXX) 555-01XX, UK: +44 1632 960XXX. Others use random digits.
  let phone: string;
  if (presetId === 'us') {
    phone = `+1 (${city.phoneArea}) 555-01${digits(rng, 2)}`;
  } else if (presetId === 'uk') {
    phone = `+44 1632 960${digits(rng, 2)}`;
  } else if (presetId === 'de') {
    phone = `+49 ${city.phoneArea} ${digits(rng, 7)}`;
  } else {
    phone = `+81 ${city.phoneArea}-${digits(rng, 4)}-${digits(rng, 4)}`;
  }

  // VAT IDs are format-valid but synthetic.
  const vatId = preset.vatPrefix ? `${preset.vatPrefix}${digits(rng, 9)}` : undefined;

  const companySuffix = pick(rng, preset.companySuffixes);
  const company = `${lastName} ${pick(rng, preset.companyTypes)} ${companySuffix}`;

  const year = 1960 + Math.floor(rng() * 45);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  const dateOfBirth = `${year}-${pad(month)}-${pad(day)}`;

  const first = transliterate(firstName);
  const last = transliterate(lastName);

  return {
    identity: {
      firstName,
      middleName,
      lastName,
      fullName: middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`,
      username: `${first}-${last}`,
      dateOfBirth,
    },
    contact: {
      email: `${first}.${last}@example.test`,
      phone,
    },
    address: {
      country: preset.meta.country,
      state: city.state,
      city: city.city,
      street,
      addressLine1,
      addressLine2,
      postalCode: city.postal,
    },
    business: {
      company,
      jobTitle: pick(rng, preset.jobTitles),
      department: pick(rng, preset.departments),
      vatId,
    },
    optional: {
      website: 'https://www.example.test',
      notes: '',
    },
  };
}

/** Creates a random seed for one-off personas. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function generatePersona(presetId: PresetId, options: GenerateOptions = {}): Persona {
  const preset = PRESETS[presetId];
  const seed = options.seed ?? randomSeed();
  const data = generatePersonaData(presetId, seed);
  const now = Date.now();
  return {
    id: createId('persona'),
    name: data.identity.fullName,
    locale: preset.meta.locale,
    country: preset.meta.country,
    createdAt: now,
    updatedAt: now,
    data,
  };
}

/**
 * Returns which persona fields are actually set — used by the UI to
 * show fill coverage without exposing values.
 */
export function personaFieldCoverage(data: PersonaData): Record<ProfileField, boolean> {
  const coverage = {} as Record<ProfileField, boolean>;
  for (const field of PROFILE_FIELDS) {
    coverage[field] = getPersonaValue(data, field).length > 0;
  }
  return coverage;
}
