import type { Classification } from './classification/types';

export type DetectedTag = 'input' | 'textarea' | 'select' | 'other';

export interface DetectedField {
  /** ProfilePack selector (may pierce open shadow roots via " >>> "). */
  selector: string;
  tag: DetectedTag;
  inputType?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  formName?: string;
  isSelect: boolean;
  optionTexts: string[];
  visible: boolean;
  classification: Classification;
}

export interface FormInfo {
  index: number;
  id?: string;
  name?: string;
  fieldCount: number;
}

/** Structural page constraints the scanner cannot cross (localized in the UI). */
export type ScanLimitationKind = 'closedShadowRoots' | 'iframes';

export interface ScanLimitation {
  kind: ScanLimitationKind;
  count: number;
}

export interface ScanResult {
  fields: DetectedField[];
  forms: FormInfo[];
  /** Password/payment/consent fields detected but intentionally skipped. */
  sensitiveSkipped: number;
  /** Structural constraints found on this page — rendered localized. */
  limitations: ScanLimitation[];
  scannedAt: number;
}
