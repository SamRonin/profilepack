import { countryAliases } from '../domain/countries';
import { formatDate, formatDateOfBirth } from '../domain/dateFormat';
import { getPersonaValue, type ProfileField } from '../domain/fields';
import type { FillRequest, FillResult, FillStatus } from '../domain/messages';
import { matchOptionCandidates, matchSelectOption } from '../domain/selectMatch';
import { stateAliases } from '../domain/states';
import {
  comboboxOptionElements,
  elementTag,
  isCombobox,
  isContentEditable,
  isVisible,
} from './detector';
import { resolveSelector } from './selector';

function fireChange(el: Element): void {
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Deferred `blur` dispatch for framework validation sync. React, Vue
 * and Formik commonly validate/commit on blur; running it one
 * microtask later keeps it behind the `input`/`change` updates in the
 * same render cycle and avoids state races during re-render.
 * `focusout` (bubbling) accompanies `blur` — React delegates onBlur
 * through it, while plain listeners can bind to either.
 */
function deferFrameworkBlur(el: HTMLElement): void {
  queueMicrotask(() => {
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

/**
 * Sets an input/textarea value through the native prototype setter so
 * React's value tracker notices the change, then dispatches input and
 * change events (bubbling) for React/Vue/Angular listeners, followed
 * by a deferred blur so validation frameworks settle in order.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const isTextarea = el.tagName.toLowerCase() === 'textarea';
  const prototype = isTextarea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) descriptor.set.call(el, value);
  else el.value = value;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  deferFrameworkBlur(el);
}

function setTextContentEditable(el: HTMLElement, value: string): void {
  el.textContent = value;
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function dispatchKeydown(el: Element, key: string): void {
  let event: Event;
  try {
    event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  } catch {
    // Environments without a KeyboardEvent constructor.
    event = new Event('keydown', { bubbles: true, cancelable: true });
  }
  el.dispatchEvent(event);
}

function dispatchMouseEvent(el: Element, type: string): void {
  try {
    // No `view` in the init: jsdom and cross-realm environments reject
    // foreign Window proxies, and bubbling/cancelable is all that
    // widget libraries actually rely on.
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  } catch {
    // Ignore — the native click() below covers this event.
  }
}

/**
 * Full pointer sequence on an option (pointer + mouse + click). Radix
 * UI commits on click, Headless UI on mousedown/click, React-Select on
 * mousedown — covering all three keeps the simulation universal.
 */
function dispatchOptionActivation(el: HTMLElement): void {
  if (typeof PointerEvent === 'function') {
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    } catch {
      // PointerEvent exists but is not constructible here — mouse events below suffice.
    }
  }
  dispatchMouseEvent(el, 'mousedown');
  dispatchMouseEvent(el, 'mouseup');
  el.click();
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
 * Fills custom ARIA combobox widgets ([role="combobox"] — Radix UI,
 * React-Select, Headless UI, …). Strategy: simulate focus, open the
 * listbox with ArrowDown, activate the matching [role="option"] and
 * confirm with Enter on the trigger. When no option elements are
 * reachable (closed/popover-rendered lists), fall back to plain
 * value-change simulation for input-based comboboxes.
 */
function fillComboboxElement(
  el: HTMLElement,
  target: ProfileField | 'custom',
  rawValue: string,
): FillStatus | { status: 'skipped'; detail: string } {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    return { status: 'skipped', detail: 'field is read-only' };
  }

  const aliases = aliasesFor(target, rawValue);
  const candidates = comboboxOptionElements(el).map((option) => ({
    el: option,
    value: option.getAttribute('value') ?? option.getAttribute('data-value') ?? '',
    text: (option.textContent ?? '').trim(),
  }));
  const match = matchOptionCandidates(candidates, aliases);

  if (match) {
    el.focus(); // engage widget focus/blur tracking before interacting
    const alreadyOpen = el.getAttribute('aria-expanded') === 'true';
    if (!alreadyOpen) dispatchKeydown(el, 'ArrowDown'); // open the listbox
    dispatchOptionActivation(match.el);
    dispatchKeydown(el, 'Enter'); // commit on keyboard-driven widgets
    return 'filled';
  }

  // Value-change simulation fallback for input-based comboboxes.
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    setNativeValue(el as HTMLInputElement | HTMLTextAreaElement, rawValue);
    return 'filled';
  }
  return { status: 'skipped', detail: 'no matching option' };
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
      if (isCombobox(el)) {
        outcome = fillComboboxElement(el as HTMLElement, mapping.target, value);
      } else if (tag === 'select') {
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
