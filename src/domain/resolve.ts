import type { FillMapping } from './messages';
import type { ScanResult } from './scan';
import type { FormTemplate } from './template';
import type { MappingTarget } from './fields';

export interface FieldOverride {
  target: MappingTarget;
  customValue?: string;
}

export interface ResolveOptions {
  /** Saved template mappings (hostname/path matched upstream). */
  template?: FormTemplate | null;
  /** Manual per-selector overrides from the UI — highest priority. */
  overrides?: Record<string, FieldOverride>;
}

export interface ResolvedMapping extends FillMapping {
  source: 'auto' | 'template' | 'manual';
  confidence: number;
}

/**
 * Combines auto classification, template mappings and manual overrides
 * into the final fill list. Priority: manual > template > auto.
 * `neverFill` fields are always dropped; `unknown` fields are only
 * filled when the user explicitly maps them.
 */
export function resolveMappings(scan: ScanResult, options: ResolveOptions = {}): ResolvedMapping[] {
  const templateBySelector = new Map(
    (options.template?.mappings ?? []).map((m) => [m.selector, m]),
  );
  const overrides = options.overrides ?? {};
  const resolved: ResolvedMapping[] = [];

  for (const field of scan.fields) {
    if (field.classification.field === 'neverFill') continue;

    const label = field.label || field.ariaLabel || field.placeholder || undefined;
    const manual = overrides[field.selector];
    if (manual) {
      resolved.push({
        selector: field.selector,
        label,
        target: manual.target,
        customValue: manual.customValue,
        source: 'manual',
        confidence: 1,
      });
      continue;
    }

    const templateMapping = templateBySelector.get(field.selector);
    if (templateMapping) {
      resolved.push({
        selector: field.selector,
        label,
        target: templateMapping.target,
        customValue: templateMapping.customValue,
        source: 'template',
        confidence: 1,
      });
      continue;
    }

    if (field.classification.field === 'unknown') continue;

    resolved.push({
      selector: field.selector,
      label,
      target: field.classification.field,
      source: 'auto',
      confidence: field.classification.confidence,
    });
  }

  return resolved;
}
