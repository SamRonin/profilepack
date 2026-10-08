import type { MappingTarget, ProfileField } from './fields';
import type { Persona } from './persona';
import type { Classification } from './classification/types';
import type { FormTemplate } from './template';

export type FillMode = 'overwrite' | 'emptyOnly';

export interface FillMapping {
  selector: string;
  /** Website-side label, used for UI display only. */
  label?: string;
  target: MappingTarget;
  customValue?: string;
}

export interface FillOptions {
  /** Locale used for date formatting (scenario locale or persona locale). */
  locale: string;
  mode: FillMode;
}

export interface FillRequest {
  persona: Persona;
  mappings: FillMapping[];
  options: FillOptions;
}

export type FillStatus = 'filled' | 'skipped' | 'not-found' | 'error';

export interface FillResult {
  selector: string;
  label?: string;
  target: string;
  status: FillStatus;
  detail?: string;
}

export interface LearnFormPayload {
  name: string;
  hostname?: string;
  pathPattern?: string;
  mappings: Array<{
    selector: string;
    label?: string;
    target: MappingTarget;
    customValue?: string;
  }>;
}

export interface DetectedFieldPayload {
  selector: string;
  tag: string;
  inputType?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  isSelect: boolean;
  optionTexts: string[];
  visible: boolean;
  classification: Classification;
}

/**
 * Typed message protocol between popup/side panel/options, the
 * background service worker and content scripts.
 */
export type RuntimeMessage =
  | { type: 'PING' }
  | { type: 'SCAN_PAGE' }
  | { type: 'GET_DETECTED_FIELDS' }
  | { type: 'FILL_FIELDS'; payload: FillRequest }
  | { type: 'LEARN_FORM'; payload: LearnFormPayload }
  | { type: 'GET_ACTIVE_PERSONA' }
  | { type: 'PAGE_SCAN_RESULT'; payload: { fieldCount: number } }
  | { type: 'OPEN_SIDE_PANEL' };

export type MessageResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === 'string' &&
    [
      'PING',
      'SCAN_PAGE',
      'GET_DETECTED_FIELDS',
      'FILL_FIELDS',
      'LEARN_FORM',
      'GET_ACTIVE_PERSONA',
      'PAGE_SCAN_RESULT',
      'OPEN_SIDE_PANEL',
    ].includes(type)
  );
}

/** Convenience message names used by the UI. */
export const MESSAGE_TYPES = {
  ping: 'PING',
  scan: 'SCAN_PAGE',
  getFields: 'GET_DETECTED_FIELDS',
  fill: 'FILL_FIELDS',
  learn: 'LEARN_FORM',
  getActivePersona: 'GET_ACTIVE_PERSONA',
  scanResult: 'PAGE_SCAN_RESULT',
  openSidePanel: 'OPEN_SIDE_PANEL',
} as const satisfies Record<string, RuntimeMessage['type']>;

export type { Persona, ProfileField, FormTemplate };
