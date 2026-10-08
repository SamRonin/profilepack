export type DateStyle = 'iso' | 'dmy-dot' | 'dmy-slash' | 'mdy-slash' | 'ymd-slash';

/** Default date style per locale (BCP-47 language tag). */
export function localeDateStyle(locale: string): DateStyle {
  const normalized = locale.trim().toLowerCase();
  if (normalized.startsWith('de')) return 'dmy-dot';
  if (normalized.startsWith('ja')) return 'ymd-slash';
  if (normalized === 'en-us' || normalized.startsWith('en-us')) return 'mdy-slash';
  if (normalized.startsWith('en')) return 'dmy-slash';
  return 'iso';
}

/**
 * Detects the intended date style from placeholder/pattern text such as
 * "DD.MM.YYYY", "mm/dd/yyyy", "JJJJ-MM-TT" or "TT.MM.JJJJ". Returns
 * null when no clear hint exists.
 */
export function detectDateStyleFromHint(text: string | null | undefined): DateStyle | null {
  if (!text) return null;
  const value = text.toLowerCase().replace(/\s+/g, '');

  if (/(^|[^a-z])(y{2,4}|j{2,4})[-/.]m{1,2}[-/.](d{1,2}|t{1,2})/.test(value)) return 'ymd-slash';
  if (/(^|[^a-z])m{1,2}[-/.]d{1,2}[-/.](y{2,4}|j{2,4})/.test(value)) return 'mdy-slash';
  if (/(^|[^a-z])(d{1,2}|t{1,2})[.]m{1,2}[.](y{2,4}|j{2,4})/.test(value)) return 'dmy-dot';
  if (/(^|[^a-z])(d{1,2}|t{1,2})[-/]m{1,2}[-/](y{2,4}|j{2,4})/.test(value)) return 'dmy-slash';
  return null;
}

/** Formats an ISO date (yyyy-mm-dd) into the requested style. */
export function formatDate(iso: string, style: DateStyle): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const year = match[1] ?? '';
  const month = match[2] ?? '';
  const day = match[3] ?? '';

  switch (style) {
    case 'dmy-dot':
      return `${day}.${month}.${year}`;
    case 'dmy-slash':
      return `${day}/${month}/${year}`;
    case 'mdy-slash':
      return `${month}/${day}/${year}`;
    case 'ymd-slash':
      return `${year}/${month}/${day}`;
    case 'iso':
    default:
      return `${year}-${month}-${day}`;
  }
}

/** Formats a persona date of birth for a given locale + optional hint. */
export function formatDateOfBirth(iso: string, locale: string, hint?: string | null): string {
  const style = detectDateStyleFromHint(hint) ?? localeDateStyle(locale);
  return formatDate(iso, style);
}
