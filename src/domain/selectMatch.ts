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

/** A select-like candidate without a native <option> element. */
export interface OptionCandidate {
  /** Machine value (e.g. option value / data-value). May be empty. */
  value?: string;
  /** Visible text of the option. */
  text: string;
}

/**
 * Generic alias matcher for non-<select> option lists (ARIA combobox
 * `[role="option"]` elements). Uses the same normalization and
 * two-pass strategy as `matchSelectOption`: exact value/text first,
 * then punctuation-insensitive.
 */
export function matchOptionCandidates<T extends OptionCandidate>(
  candidates: T[],
  aliases: string[],
): T | null {
  const aliasSet = new Set(aliases.map(normalizeOptionText).filter(Boolean));
  if (aliasSet.size === 0 || candidates.length === 0) return null;
  const aliasCompact = new Set(
    [...aliasSet].map((a) => a.replace(/[^a-z0-9]/g, '')).filter(Boolean),
  );

  for (const candidate of candidates) {
    const value = normalizeOptionText(candidate.value ?? '');
    const text = normalizeOptionText(candidate.text);
    if (aliasSet.has(value) || aliasSet.has(text)) return candidate;
  }

  for (const candidate of candidates) {
    const value = normalizeOptionText(candidate.value ?? '').replace(/[^a-z0-9]/g, '');
    const text = normalizeOptionText(candidate.text).replace(/[^a-z0-9]/g, '');
    if (value && aliasCompact.has(value)) return candidate;
    if (text && aliasCompact.has(text)) return candidate;
  }

  return null;
}
