import { classifyField } from '../domain/classification/classifier';
import type { FieldInput } from '../domain/classification/types';
import type { DetectedField, DetectedTag, FormInfo, ScanResult } from '../domain/scan';
import {
  ariaLabelledByText,
  collectFields,
  elementTag,
  formContext,
  isFillable,
  isSensitive,
  isVisible,
  nearbyText,
  resolveLabelText,
} from './detector';
import { buildSelector } from './selector';

const MAX_FIELDS = 300;

function extractFieldInput(el: Element, tag: DetectedTag): FieldInput {
  const form = formContext(el);
  const label = resolveLabelText(el);
  const ariaLabel = el.getAttribute('aria-label') || ariaLabelledByText(el) || undefined;
  const isSelect = tag === 'select';
  const optionTexts = isSelect
    ? Array.from((el as HTMLSelectElement).options).map((o) => o.text || o.value)
    : [];

  return {
    tag,
    inputType: tag === 'input' ? (el.getAttribute('type') ?? 'text').toLowerCase() : undefined,
    name: el.getAttribute('name') || undefined,
    id: el.id || undefined,
    autocomplete: el.getAttribute('autocomplete') || undefined,
    label: label || undefined,
    ariaLabel: ariaLabel || undefined,
    placeholder: el.getAttribute('placeholder') || undefined,
    nearbyText: label ? undefined : nearbyText(el),
    formName: form.formName,
    formId: form.formId,
    legend: form.legend,
    isSelect,
    optionTexts,
  };
}

function buildLimitations(closedRoots: number, iframes: number): string[] {
  const limitations: string[] = [];
  if (closedRoots > 0) {
    limitations.push(
      `${closedRoots} possible closed shadow root(s) detected — fields inside them cannot be reached by any extension.`,
    );
  }
  if (iframes > 0) {
    limitations.push(
      `${iframes} iframe(s) detected — cross-origin iframes are intentionally not scanned.`,
    );
  }
  return limitations;
}

/**
 * Scans the given document (including open shadow roots) for fillable
 * fields and classifies every one of them.
 */
export function scanDocument(doc: Document = document): ScanResult {
  const collected = collectFields(doc);
  const forms: FormInfo[] = [];
  const formIndex = new Map<HTMLFormElement, number>();
  const fields: DetectedField[] = [];
  let sensitiveSkipped = 0;

  for (const el of collected.elements) {
    if (!isFillable(el)) {
      if (isSensitive(el)) sensitiveSkipped++;
      continue;
    }
    if (isSensitive(el)) {
      sensitiveSkipped++;
      continue;
    }

    const tag = elementTag(el);
    const input = extractFieldInput(el, tag);
    const form = (el as HTMLInputElement).form ?? el.closest('form') ?? null;
    let formName: string | undefined;
    if (form) {
      let index = formIndex.get(form);
      if (index === undefined) {
        index = forms.length;
        formIndex.set(form, index);
        forms.push({
          index,
          id: form.id || undefined,
          name: form.getAttribute('name') ?? undefined,
          fieldCount: 0,
        });
      }
      const info = forms[index];
      if (info) info.fieldCount++;
      formName = form.getAttribute('name') ?? (form.id || undefined);
    }

    fields.push({
      selector: buildSelector(el),
      tag,
      inputType: input.inputType,
      name: input.name,
      id: input.id,
      autocomplete: input.autocomplete,
      label: input.label,
      placeholder: input.placeholder,
      ariaLabel: input.ariaLabel,
      formName,
      isSelect: input.isSelect ?? false,
      optionTexts: input.optionTexts ?? [],
      visible: isVisible(el),
      classification: classifyField(input),
    });

    if (fields.length >= MAX_FIELDS) break;
  }

  return {
    fields,
    forms,
    sensitiveSkipped,
    limitations: buildLimitations(collected.possibleClosedRoots, collected.iframes),
    scannedAt: Date.now(),
  };
}
