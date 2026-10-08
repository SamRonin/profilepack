import { countryAliases } from '../domain/countries';
import { formatDate, formatDateOfBirth } from '../domain/dateFormat';
import { getPersonaValue, type ProfileField } from '../domain/fields';
import type { FillRequest, FillResult, FillStatus } from '../domain/messages';
import { matchSelectOption } from '../domain/selectMatch';
import { stateAliases } from '../domain/states';
import { elementTag, isContentEditable, isVisible } from './detector';
import { resolveSelector } from './selector';

function fireChange(el: Element): void {
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Sets an input/textarea value through the native prototype setter so
 * React's value tracker notices the change, then dispatches input and
 * change events (bubbling) for React/Vue/Angular listeners.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const isTextarea = el.tagName.toLowerCase() === 'textarea';
  const prototype = isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) descriptor.set.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setTextContentEditable(el: HTMLElement, value: string): void {
  el.textContent = value;
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

const TRUE_VALUES = new Set(['true', 'yes', '1', 'on', 'x']);
const FALSE_VALUES = new Set(['false', 'no', '0', 'off', '']);

function aliasesFor(target: ProfileField | 'custom', value: string): string[] {
  if (target === 'country') return countryAliases(value);
  if (target === 'state') return stateAliases(value);
  return [value];
}

function skipped(
  selector: string,
  mapping: FillRequest['mappings'][number],
  detail: string,
): FillResult {
  return {
    selector,
    label: mapping.label,
    target: mapping.target,
    status: 'skipped',
    detail,
  };
}

function fillInputElement(
  el: HTMLInputElement,
  target: ProfileField | 'custom',
  rawValue: string,
  locale: string,
): FillStatus | { status: 'skipped'; detail: string } {
  if (el.readOnly || el.disabled) return { status: 'skipped', detail: 'field is read-only' };

  if (el.type === 'date') {
    setNativeValue(el, formatDate(rawValue, 'iso'));
    return 'filled';
  }
  if (el.type === 'month') {
    const iso = /^(\d{4})-(\d{2})/.exec(rawValue.trim());
    setNativeValue(el, iso ? `${iso[1]}-${iso[2]}` : rawValue);
    return 'filled';
  }
  if (el.type === 'radio') {
    const scope = el.form ?? el.ownerDocument;
    const group = Array.from(
      scope.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).filter((radio) => radio.name === el.name);
    const aliases = aliasesFor(target, rawValue).map((a) => a.trim().toLowerCase());
    const match = group.find((radio) => aliases.includes(radio.value.trim().toLowerCase()));
    if (!match) return { status: 'skipped', detail: 'no matching radio option' };
    // Native click() toggles the state and fires click + input + change,
    // which is what frameworks listen for. Never dispatch a synthetic
    // click manually — that would toggle the value twice in Chrome.
    if (!match.checked) match.click();
    return 'filled';
  }
  if (el.type === 'checkbox') {
    const normalized = rawValue.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized) && !el.checked) el.click();
    else if (FALSE_VALUES.has(normalized) && el.checked) el.click();
    return 'filled';
  }

  let value = rawValue;
  if (target === 'dateOfBirth' && el.type === 'text') {
    value = formatDateOfBirth(rawValue, locale, el.placeholder || el.getAttribute('pattern'));
  }
  setNativeValue(el, value);
  return 'filled';
}

function fillSelectElement(
  el: HTMLSelectElement,
  target: ProfileField | 'custom',
  rawValue: string,
): FillStatus | { status: 'skipped'; detail: string } {
  if (el.disabled) return { status: 'skipped', detail: 'field is read-only' };
  const option = matchSelectOption(el, aliasesFor(target, rawValue));
  if (!option) return { status: 'skipped', detail: 'no matching option' };
  if (el.value !== option.value) {
    el.value = option.value;
    fireChange(el);
  }
  return 'filled';
}

/**
 * Fills all requested fields inside the given document. Never submits
 * forms, never touches fields that were filtered out upstream
 * (passwords, payment, consent checkboxes).
 */
export function fillFields(request: FillRequest, doc: Document = document): FillResult[] {
  const results: FillResult[] = [];

  for (const mapping of request.mappings) {
    if (mapping.target === 'ignore') {
      results.push(skipped(mapping.selector, mapping, 'ignored'));
      continue;
    }

    const el = resolveSelector(mapping.selector, doc);
    if (!el) {
      results.push({
        selector: mapping.selector,
        label: mapping.label,
        target: mapping.target,
        status: 'not-found',
        detail: 'element not found on page',
      });
      continue;
    }
    if (!isVisible(el)) {
      results.push(skipped(mapping.selector, mapping, 'field is not visible'));
      continue;
    }

    const value =
      mapping.target === 'custom'
        ? (mapping.customValue ?? '')
        : getPersonaValue(request.persona.data, mapping.target);

    if (!value || !value.trim()) {
      results.push(skipped(mapping.selector, mapping, 'no value for this field in the persona'));
      continue;
    }

    try {
      if (request.options.mode === 'emptyOnly' && !isContentEditable(el)) {
        const current = 'value' in el ? String((el as HTMLInputElement).value ?? '').trim() : '';
        if (current) {
          results.push(skipped(mapping.selector, mapping, 'already filled (empty-only mode)'));
          continue;
        }
      }

      let outcome: FillStatus | { status: 'skipped'; detail: string };
      const tag = elementTag(el);
      if (tag === 'select') {
        outcome = fillSelectElement(el as HTMLSelectElement, mapping.target, value);
      } else if (tag === 'input') {
        outcome = fillInputElement(
          el as HTMLInputElement,
          mapping.target,
          value,
          request.options.locale,
        );
      } else if (tag === 'textarea') {
        setNativeValue(el as HTMLTextAreaElement, value);
        outcome = 'filled';
      } else if (isContentEditable(el)) {
        setTextContentEditable(el as HTMLElement, value);
        outcome = 'filled';
      } else {
        outcome = { status: 'skipped', detail: 'unsupported element' };
      }

      if (typeof outcome === 'string') {
        results.push({
          selector: mapping.selector,
          label: mapping.label,
          target: mapping.target,
          status: outcome,
        });
      } else {
        results.push({
          selector: mapping.selector,
          label: mapping.label,
          target: mapping.target,
          status: outcome.status,
          detail: outcome.detail,
        });
      }
    } catch (error) {
      results.push({
        selector: mapping.selector,
        label: mapping.label,
        target: mapping.target,
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
