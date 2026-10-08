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

export interface ScanResult {
  fields: DetectedField[];
  forms: FormInfo[];
  /** Password/payment/consent fields detected but intentionally skipped. */
  sensitiveSkipped: number;
  /** Human-readable constraints found on this page. */
  limitations: string[];
  scannedAt: number;
}
