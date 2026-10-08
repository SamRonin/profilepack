export interface CountryEntry {
  /** Canonical English name (this is what personas store). */
  name: string;
  de?: string;
  iso2: string;
  iso3: string;
  alt?: string;
}

/**
 * Alias table used for <select> matching: an option like "DE", "DEU",
 * "Deutschland" or "Germany" all resolve to the same country.
 * Extendable — matching is normalization-based, not hard-coded.
 */
export const COUNTRIES: CountryEntry[] = [
  { name: 'Germany', de: 'Deutschland', iso2: 'DE', iso3: 'DEU' },
  { name: 'United States', de: 'Vereinigte Staaten', iso2: 'US', iso3: 'USA', alt: 'USA' },
  { name: 'United Kingdom', de: 'Vereinigtes Königreich', iso2: 'GB', iso3: 'GBR', alt: 'UK' },
  { name: 'Japan', iso2: 'JP', iso3: 'JPN', alt: '日本' },
  { name: 'Austria', de: 'Österreich', iso2: 'AT', iso3: 'AUT' },
  { name: 'Switzerland', de: 'Schweiz', iso2: 'CH', iso3: 'CHE' },
  { name: 'France', de: 'Frankreich', iso2: 'FR', iso3: 'FRA' },
  { name: 'Italy', de: 'Italien', iso2: 'IT', iso3: 'ITA' },
  { name: 'Spain', de: 'Spanien', iso2: 'ES', iso3: 'ESP' },
  { name: 'Netherlands', de: 'Niederlande', iso2: 'NL', iso3: 'NLD', alt: 'Holland' },
  { name: 'Belgium', de: 'Belgien', iso2: 'BE', iso3: 'BEL' },
  { name: 'Poland', de: 'Polen', iso2: 'PL', iso3: 'POL' },
  { name: 'Sweden', de: 'Schweden', iso2: 'SE', iso3: 'SWE' },
  { name: 'Norway', de: 'Norwegen', iso2: 'NO', iso3: 'NOR' },
  { name: 'Denmark', de: 'Dänemark', iso2: 'DK', iso3: 'DNK' },
  { name: 'Finland', de: 'Finnland', iso2: 'FI', iso3: 'FIN' },
  { name: 'Ireland', de: 'Irland', iso2: 'IE', iso3: 'IRL' },
  { name: 'Portugal', de: 'Portugal', iso2: 'PT', iso3: 'PRT' },
  { name: 'Greece', de: 'Griechenland', iso2: 'GR', iso3: 'GRC' },
  { name: 'Czechia', de: 'Tschechien', iso2: 'CZ', iso3: 'CZE', alt: 'Czech Republic' },
  { name: 'Turkey', de: 'Türkei', iso2: 'TR', iso3: 'TUR' },
  { name: 'Canada', de: 'Kanada', iso2: 'CA', iso3: 'CAN' },
  { name: 'Australia', de: 'Australien', iso2: 'AU', iso3: 'AUS' },
  { name: 'New Zealand', de: 'Neuseeland', iso2: 'NZ', iso3: 'NZL' },
  { name: 'Brazil', de: 'Brasilien', iso2: 'BR', iso3: 'BRA' },
  { name: 'Mexico', de: 'Mexiko', iso2: 'MX', iso3: 'MEX' },
  { name: 'Argentina', de: 'Argentinien', iso2: 'AR', iso3: 'ARG' },
  { name: 'Chile', de: 'Chile', iso2: 'CL', iso3: 'CHL' },
  { name: 'Colombia', de: 'Kolumbien', iso2: 'CO', iso3: 'COL' },
  { name: 'India', de: 'Indien', iso2: 'IN', iso3: 'IND' },
  { name: 'China', de: 'China', iso2: 'CN', iso3: 'CHN' },
  { name: 'South Korea', de: 'Südkorea', iso2: 'KR', iso3: 'KOR', alt: 'Republic of Korea' },
  { name: 'Singapore', de: 'Singapur', iso2: 'SG', iso3: 'SGP' },
  {
    name: 'United Arab Emirates',
    de: 'Vereinigte Arabische Emirate',
    iso2: 'AE',
    iso3: 'ARE',
    alt: 'UAE',
  },
  { name: 'Saudi Arabia', de: 'Saudi-Arabien', iso2: 'SA', iso3: 'SAU' },
  { name: 'South Africa', de: 'Südafrika', iso2: 'ZA', iso3: 'ZAF' },
  { name: 'Israel', de: 'Israel', iso2: 'IL', iso3: 'ISR' },
  { name: 'Russia', de: 'Russland', iso2: 'RU', iso3: 'RUS' },
  { name: 'Ukraine', de: 'Ukraine', iso2: 'UA', iso3: 'UKR' },
  { name: 'Hungary', de: 'Ungarn', iso2: 'HU', iso3: 'HUN' },
  { name: 'Romania', de: 'Rumänien', iso2: 'RO', iso3: 'ROU' },
  { name: 'Bulgaria', de: 'Bulgarien', iso2: 'BG', iso3: 'BGR' },
  { name: 'Croatia', de: 'Kroatien', iso2: 'HR', iso3: 'HRV' },
  { name: 'Slovakia', de: 'Slowakei', iso2: 'SK', iso3: 'SVK' },
  { name: 'Slovenia', de: 'Slowenien', iso2: 'SI', iso3: 'SVN' },
  { name: 'Estonia', de: 'Estland', iso2: 'EE', iso3: 'EST' },
  { name: 'Latvia', de: 'Lettland', iso2: 'LV', iso3: 'LVA' },
  { name: 'Lithuania', de: 'Litauen', iso2: 'LT', iso3: 'LTU' },
  { name: 'Luxembourg', de: 'Luxemburg', iso2: 'LU', iso3: 'LUX' },
  { name: 'Malta', de: 'Malta', iso2: 'MT', iso3: 'MLT' },
  { name: 'Cyprus', de: 'Zypern', iso2: 'CY', iso3: 'CYP' },
  { name: 'Iceland', de: 'Island', iso2: 'IS', iso3: 'ISL' },
  { name: 'Liechtenstein', de: 'Liechtenstein', iso2: 'LI', iso3: 'LIE' },
  { name: 'Thailand', de: 'Thailand', iso2: 'TH', iso3: 'THA' },
  { name: 'Vietnam', de: 'Vietnam', iso2: 'VN', iso3: 'VNM' },
  { name: 'Indonesia', de: 'Indonesien', iso2: 'ID', iso3: 'IDN' },
  { name: 'Malaysia', de: 'Malaysia', iso2: 'MY', iso3: 'MYS' },
  { name: 'Philippines', de: 'Philippinen', iso2: 'PH', iso3: 'PHL' },
  { name: 'Pakistan', de: 'Pakistan', iso2: 'PK', iso3: 'PAK' },
  { name: 'Egypt', de: 'Ägypten', iso2: 'EG', iso3: 'EGY' },
  { name: 'Nigeria', de: 'Nigeria', iso2: 'NG', iso3: 'NGA' },
  { name: 'Morocco', de: 'Marokko', iso2: 'MA', iso3: 'MAR' },
  { name: 'Kenya', de: 'Kenia', iso2: 'KE', iso3: 'KEN' },
];

/** All textual aliases (English, German, ISO-2, ISO-3, common alternatives). */
export function countryAliasList(entry: CountryEntry): string[] {
  return [entry.name, entry.de, entry.iso2, entry.iso3, entry.alt].filter((v): v is string =>
    Boolean(v),
  );
}

export function normalizeOptionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Returns true when the text matches any known country alias. */
export function isCountryText(text: string): boolean {
  const normalized = normalizeOptionText(text);
  if (!normalized) return false;
  return COUNTRIES.some((c) =>
    countryAliasList(c).some((a) => normalizeOptionText(a) === normalized),
  );
}

/**
 * Resolves the alias list for a country stored on a persona. Unknown
 * countries gracefully fall back to the stored string itself.
 */
export function countryAliases(country: string): string[] {
  const normalized = normalizeOptionText(country);
  const entry = COUNTRIES.find((c) =>
    countryAliasList(c).some((a) => normalizeOptionText(a) === normalized),
  );
  if (entry) return countryAliasList(entry);
  return country ? [country] : [];
}
