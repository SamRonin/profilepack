import type {
  Classification,
  ClassificationKind,
  FieldInput,
  SignalMatch,
  SignalName,
} from './types';
import { unknownClassification } from './types';
import { DICTIONARY, type DictField } from './dictionary';
import { AUTOCOMPLETE_MAP, NOISE_PREFIXES, TYPE_MAP } from './signals';
import { isCountryText } from '../countries';
import type { ProfileField } from '../fields';

export { type Classification, type FieldInput } from './types';

/** Confidence weight per signal. */
const WEIGHTS: Record<SignalName, number> = {
  autocomplete: 0.99,
  name: 0.92,
  id: 0.88,
  type: 0.95,
  label: 0.85,
  aria: 0.8,
  placeholder: 0.62,
  nearby: 0.45,
  context: 0.4,
  options: 0.9,
};

/** Bonus per additional signal that agrees with the winning field. */
const AGREEMENT_BONUS = 0.04;
/** Below this the field is reported as `unknown`. */
const UNKNOWN_THRESHOLD = 0.55;
/** Below this (or on conflict) the UI asks the user to review. */
const REVIEW_THRESHOLD = 0.75;
/** If the runner-up is this close to the winner, flag a conflict. */
const CONFLICT_MARGIN = 0.1;

/**
 * Tokenizes a candidate string: camelCase, kebab-case, snake_case and
 * dotted variants all collapse to the same tokens, digits are split
 * from letters ("addressLine1" -> [address, line, 1]). German umlauts
 * are transliterated first so "straße" and "strasse" match equally.
 * Persian (and Arabic-script) text is preserved: ZWNJ acts as a
 * separator, Arabic Yeh/Kaf variants fold to the Persian forms and
 * Persian digits normalize to their Latin counterparts.
 */
export function tokenize(raw: string): string[] {
  return raw
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ي/g, 'ی') // Arabic yeh -> Persian yeh
    .replace(/ك/g, 'ک') // Arabic kaf -> Persian keheh
    .replace(/\u200C/g, ' ') // ZWNJ (نیم‌فاصله) -> separator
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹ -> 0-9
    .replace(/([a-z0-9])([\u0600-\u06FF])/g, '$1 $2') // Latin/Arabic-script boundary
    .replace(/([\u0600-\u06FF])([a-z0-9])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/)
    .filter(Boolean);
}

function stripNoisePrefixes(tokens: string[]): string[] {
  let tokens_mut = [...tokens];
  while (tokens_mut.length > 1 && NOISE_PREFIXES.has(tokens_mut[0] ?? '')) {
    tokens_mut = tokens_mut.slice(1);
  }
  return tokens_mut;
}

function compactForm(tokens: string[]): string {
  return tokens.join('');
}

/** Token-based term matching with a boundary-aware compact fallback. */
function termMatches(candidateTokens: string[], term: string): boolean {
  const termTokens = tokenize(term);
  if (termTokens.length === 0 || termTokens.length > candidateTokens.length) return false;

  for (let start = 0; start + termTokens.length <= candidateTokens.length; start++) {
    let ok = true;
    for (let i = 0; i < termTokens.length; i++) {
      if (candidateTokens[start + i] !== termTokens[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  // Fallback for concatenated candidates like "companyname" that are not
  // camelCase. The term must start at a token boundary ("custid" does not
  // contain "ustid" at a boundary). Generic short terms ("name") are
  // excluded to avoid false positives such as "username" or "lastname".
  const termCompact = term.replace(/[^a-z0-9]/g, '');
  if (termCompact.length >= 5) {
    const candidateCompact = compactForm(candidateTokens);
    const boundaries: number[] = [];
    let offset = 0;
    for (const token of candidateTokens) {
      boundaries.push(offset);
      offset += token.length;
    }
    const index = candidateCompact.indexOf(termCompact);
    return index >= 0 && boundaries.includes(index);
  }
  return false;
}

interface CollectOptions {
  stripPrefixes?: boolean;
}

function collectDictionaryMatches(
  out: SignalMatch[],
  signal: SignalName,
  raw: string | undefined,
  weight: number,
  options: CollectOptions = {},
): void {
  if (!raw || !raw.trim()) return;
  let tokens = tokenize(raw);
  if (options.stripPrefixes) tokens = stripNoisePrefixes(tokens);
  if (tokens.length === 0) return;

  // Collect every dictionary match for this signal, then keep only the
  // most specific term(s). This prevents generic terms ("name") from
  // drowning out specific ones ("company name") within the same signal.
  interface Candidate {
    field: DictField;
    term: string;
    specificity: number;
  }
  const candidates: Candidate[] = [];

  for (const entry of DICTIONARY) {
    for (const term of entry.terms) {
      if (termMatches(tokens, term)) {
        candidates.push({
          field: entry.field,
          term,
          specificity: entry.field === 'neverFill' ? 3 : tokenize(term).length,
        });
      }
    }
  }

  if (candidates.length === 0) return;
  const maxSpecificity = Math.max(...candidates.map((c) => c.specificity));
  for (const candidate of candidates) {
    if (candidate.specificity !== maxSpecificity) continue;
    out.push({
      signal,
      field: candidate.field,
      score: weight,
      evidence: candidate.term,
      specificity: candidate.specificity,
    });
  }
}

function autocompleteCandidates(value: string): string[] {
  const tokens = value.trim().split(/\s+/);
  const out = [value.trim()];
  if (tokens.length >= 2) out.push(tokens.slice(-2).join(' '));
  if (tokens.length >= 1) out.push(tokens[tokens.length - 1] ?? '');
  return out;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function describeSignals(matches: SignalMatch[]): string {
  return matches
    .map((s) => `${s.signal}: "${s.evidence}" -> ${s.field} (${s.score.toFixed(2)})`)
    .join('; ');
}

/**
 * Classifies a single form field by combining multiple signals
 * (autocomplete, name, id, type, label, aria-label, placeholder,
 * nearby text, form context, select options) into one decision with a
 * confidence score.
 */
export function classifyField(input: FieldInput): Classification {
  const signals: SignalMatch[] = [];

  if (input.autocomplete && input.autocomplete.trim().length > 0) {
    for (const candidate of autocompleteCandidates(input.autocomplete)) {
      const mapped = AUTOCOMPLETE_MAP[candidate.trim().toLowerCase()];
      if (mapped) {
        signals.push({
          signal: 'autocomplete',
          field: mapped,
          score: WEIGHTS.autocomplete,
          evidence: `autocomplete="${candidate.trim()}"`,
          specificity: 3,
        });
        break;
      }
    }
  }

  collectDictionaryMatches(signals, 'name', input.name, WEIGHTS.name, { stripPrefixes: true });
  collectDictionaryMatches(signals, 'id', input.id, WEIGHTS.id, { stripPrefixes: true });
  collectDictionaryMatches(signals, 'label', input.label, WEIGHTS.label);
  collectDictionaryMatches(signals, 'aria', input.ariaLabel, WEIGHTS.aria);
  collectDictionaryMatches(signals, 'placeholder', input.placeholder, WEIGHTS.placeholder);
  collectDictionaryMatches(signals, 'nearby', input.nearbyText, WEIGHTS.nearby);

  const contextText = [input.formName, input.formId, input.legend].filter(Boolean).join(' ');
  if (contextText.trim()) {
    collectDictionaryMatches(signals, 'context', contextText, WEIGHTS.context, {
      stripPrefixes: true,
    });
  }

  const typeEntry = input.inputType ? TYPE_MAP[input.inputType] : undefined;
  if (typeEntry) {
    signals.push({
      signal: 'type',
      field: typeEntry.field,
      score: typeEntry.score,
      evidence: `type="${input.inputType}"`,
      specificity: 2,
    });
  }

  if (input.isSelect && input.optionTexts && input.optionTexts.length > 1) {
    const countryHits = input.optionTexts.filter((t) => isCountryText(t)).length;
    if (countryHits >= 2) {
      signals.push({
        signal: 'options',
        field: 'country',
        score: WEIGHTS.options,
        evidence: `${countryHits} options match country names`,
        specificity: 2,
      });
    }
  }

  // Never-fill fields dominate everything else.
  const neverFillSignals = signals.filter((s) => s.field === 'neverFill');
  if (neverFillSignals.length > 0) {
    const best = neverFillSignals.reduce((a, b) => (b.score > a.score ? b : a));
    return {
      field: 'neverFill',
      confidence: Math.min(0.99, round2(best.score + 0.1)),
      needsReview: false,
      reason: `Sensitive field (matched "${best.evidence}" via ${best.signal}) — never filled by ProfilePack`,
      signals,
    };
  }

  if (signals.length === 0) {
    return unknownClassification();
  }

  // Group by field, then by signal group (name+id are the same kind of
  // evidence and must not double-count), and combine agreeing groups.
  const GROUP_OF: Record<SignalName, string> = {
    autocomplete: 'autocomplete',
    name: 'attribute',
    id: 'attribute',
    type: 'type',
    label: 'label',
    aria: 'aria',
    placeholder: 'placeholder',
    nearby: 'nearby',
    context: 'context',
    options: 'options',
  };

  const byField = new Map<ClassificationKind, Map<string, SignalMatch>>();
  for (const s of signals) {
    let byGroup = byField.get(s.field);
    if (!byGroup) {
      byGroup = new Map();
      byField.set(s.field, byGroup);
    }
    const group = GROUP_OF[s.signal];
    const existing = byGroup.get(group);
    if (
      !existing ||
      s.score > existing.score ||
      (s.score === existing.score && s.specificity > existing.specificity)
    ) {
      byGroup.set(group, s);
    }
  }

  const scored = [...byField.entries()]
    .map(([field, byGroup]) => {
      const groupSignals = [...byGroup.values()];
      const best = groupSignals.reduce((a, b) =>
        b.score > a.score || (b.score === a.score && b.specificity > a.specificity) ? b : a,
      );
      const score = Math.min(0.99, best.score + AGREEMENT_BONUS * (groupSignals.length - 1));
      return { field, score, best, specificity: best.specificity, groupSignals };
    })
    .sort((a, b) => b.score - a.score || b.specificity - a.specificity);

  const winner = scored[0];
  if (!winner) return unknownClassification();

  if (winner.score < UNKNOWN_THRESHOLD) {
    return {
      field: 'unknown',
      confidence: round2(winner.score),
      needsReview: true,
      reason: `Weak signals — ${describeSignals([winner.best])}`,
      signals,
    };
  }

  const runnerUp = scored[1];
  const conflict =
    runnerUp !== undefined &&
    runnerUp.score >= winner.score - CONFLICT_MARGIN &&
    runnerUp.best.score >= 0.6;

  let confidence = winner.score;
  if (conflict) {
    confidence = Math.min(0.85, confidence * 0.85);
  }

  const winnerSignals = winner.groupSignals.slice(0, 3);
  const reason = conflict
    ? `${describeSignals(winnerSignals)} — conflicting signals (runner-up: ${runnerUp?.field})`
    : describeSignals(winnerSignals);

  return {
    field: winner.field as ProfileField,
    confidence: round2(confidence),
    needsReview: conflict || confidence < REVIEW_THRESHOLD,
    reason,
    signals,
  };
}
