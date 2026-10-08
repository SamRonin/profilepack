import type { ProfileField } from '../fields';

/** Result kind of the classifier. */
export type ClassificationKind = ProfileField | 'unknown' | 'neverFill';

export type SignalName =
  | 'autocomplete'
  | 'name'
  | 'id'
  | 'type'
  | 'label'
  | 'aria'
  | 'placeholder'
  | 'nearby'
  | 'context'
  | 'options';

/** A single piece of evidence that a field maps to a schema field. */
export interface SignalMatch {
  signal: SignalName;
  field: ClassificationKind;
  score: number;
  /** Human-readable evidence, e.g. `name="billing_zip"`. */
  evidence: string;
  /** Number of dictionary tokens — used as a specificity tie-breaker. */
  specificity: number;
}

export interface Classification {
  field: ClassificationKind;
  /** 0..1. */
  confidence: number;
  /** When true the UI should ask the user to confirm the mapping. */
  needsReview: boolean;
  /** Human-readable explanation of the decision. */
  reason: string;
  signals: SignalMatch[];
}

/** Normalized input gathered from the DOM for one field. */
export interface FieldInput {
  tag: string;
  inputType?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  nearbyText?: string;
  formName?: string;
  formId?: string;
  legend?: string;
  isSelect?: boolean;
  optionTexts?: string[];
}

export function unknownClassification(reason = 'No recognizable signals'): Classification {
  return { field: 'unknown', confidence: 0, needsReview: true, reason, signals: [] };
}
