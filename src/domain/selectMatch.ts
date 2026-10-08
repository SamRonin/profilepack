import { normalizeOptionText } from './countries';

/**
 * Matches a <select> option against a list of aliases (e.g. country
 * names in several languages plus ISO codes). Comparison covers
 * option value, label and text, case-insensitively and with a
 * punctuation-insensitive second pass.
 */
export function matchSelectOption(
  select: HTMLSelectElement,
  aliases: string[],
): HTMLOptionElement | null {
  const aliasSet = new Set(aliases.map(normalizeOptionText).filter(Boolean));
  if (aliasSet.size === 0) return null;
  const aliasCompact = new Set(
    [...aliasSet].map((a) => a.replace(/[^a-z0-9]/g, '')).filter(Boolean),
  );

  const options = Array.from(select.options);

  // First pass: exact match on value, label or visible text.
  for (const opt of options) {
    const value = normalizeOptionText(opt.value);
    const text = normalizeOptionText(opt.text);
    const label = normalizeOptionText(opt.label || '');
    if (aliasSet.has(value) || aliasSet.has(text) || aliasSet.has(label)) return opt;
  }

  // Second pass: punctuation-insensitive ("United States" vs "united-states").
  for (const opt of options) {
    const value = normalizeOptionText(opt.value).replace(/[^a-z0-9]/g, '');
    const text = normalizeOptionText(opt.text).replace(/[^a-z0-9]/g, '');
    if (value && aliasCompact.has(value)) return opt;
    if (text && aliasCompact.has(text)) return opt;
  }

  return null;
}
