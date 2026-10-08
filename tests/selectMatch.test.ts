import { describe, expect, it } from 'vitest';

import { countryAliases, isCountryText } from '../src/domain/countries';
import { stateAliases } from '../src/domain/states';
import { matchSelectOption } from '../src/domain/selectMatch';

function buildSelect(options: Array<[value: string, text: string]>): HTMLSelectElement {
  const select = document.createElement('select');
  for (const [value, text] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
  document.body.appendChild(select);
  return select;
}

describe('select matching', () => {
  it('matches country by English name, German name, ISO-2 and ISO-3', () => {
    const select = buildSelect([
      ['', 'Please select'],
      ['DEU', 'Germany'],
      ['AUT', 'Austria'],
      ['USA', 'United States'],
    ]);
    const aliases = countryAliases('Germany');

    // value match (ISO-3)
    expect(matchSelectOption(select, aliases)?.value).toBe('DEU');
    // text match
    expect(matchSelectOption(select, ['Germany'])?.value).toBe('DEU');

    select.remove();

    // ISO-2 valued options
    const iso2Select = buildSelect([
      ['DE', 'Germany'],
      ['AT', 'Austria'],
    ]);
    expect(matchSelectOption(iso2Select, ['DE'])?.value).toBe('DE');
    expect(matchSelectOption(iso2Select, countryAliases('Germany'))?.value).toBe('DE');
    iso2Select.remove();

    // German option text
    const germanSelect = buildSelect([
      ['de', 'Deutschland'],
      ['at', 'Österreich'],
    ]);
    expect(matchSelectOption(germanSelect, ['Deutschland'])?.value).toBe('de');
    expect(matchSelectOption(germanSelect, countryAliases('Germany'))?.value).toBe('de');
    germanSelect.remove();
  });

  it('is case- and whitespace-insensitive', () => {
    const select = buildSelect([
      ['de', 'Germany'],
      ['at', 'Austria'],
    ]);
    expect(matchSelectOption(select, ['  GERMANY '])?.value).toBe('de');
    expect(matchSelectOption(select, ['germany'])?.value).toBe('de');
    select.remove();
  });

  it('matches punctuation-insensitively', () => {
    const select = buildSelect([
      ['gb', 'United-Kingdom'],
      ['us', 'United States'],
    ]);
    expect(matchSelectOption(select, ['United States'])?.value).toBe('us');
    expect(matchSelectOption(select, ['united kingdom'])?.value).toBe('gb');
    select.remove();
  });

  it('returns null when nothing matches', () => {
    const select = buildSelect([
      ['x', 'Atlantis'],
      ['y', 'Wakanda'],
    ]);
    expect(matchSelectOption(select, countryAliases('Germany'))).toBeNull();
    select.remove();
  });

  it('detects country-looking option lists', () => {
    expect(isCountryText('Germany')).toBe(true);
    expect(isCountryText('deutschland')).toBe(true);
    expect(isCountryText('DEU')).toBe(true);
    expect(isCountryText('日本')).toBe(true);
    expect(isCountryText('Banana')).toBe(false);
  });

  it('matches US states by name and abbreviation', () => {
    const select = buildSelect([
      ['', 'Select…'],
      ['TX', 'Texas'],
      ['CA', 'California'],
    ]);
    expect(matchSelectOption(select, stateAliases('Texas'))?.value).toBe('TX');
    expect(matchSelectOption(select, stateAliases('tx'))?.value).toBe('TX');
    expect(matchSelectOption(select, stateAliases('Bavaria'))).toBeNull();
    select.remove();
  });

  it('falls back to the raw value for unknown countries', () => {
    expect(countryAliases('Atlantis')).toEqual(['Atlantis']);
  });
});
