/** Elements the detector considers fillable. */
export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

const FIELD_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="combobox"]';

const SKIP_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'reset',
  'image',
  'file',
  'range',
  'color',
]);

export interface CollectResult {
  elements: Set<Element>;
  /** Custom elements that may host closed shadow roots (not readable). */
  possibleClosedRoots: number;
  iframes: number;
}

function collect(root: ParentNode, out: CollectResult): void {
  root.querySelectorAll(FIELD_SELECTOR).forEach((el) => out.elements.add(el));

  // Recursive open-shadow-root traversal: every element is checked for a
  // shadowRoot and descended into, so web components / custom elements
  // hosting form controls are discovered at any nesting depth.
  root.querySelectorAll('*').forEach((el) => {
    const shadow = (el as HTMLElement).shadowRoot;
    if (shadow) {
      collect(shadow, out);
      return;
    }
    if (el.tagName === 'IFRAME') out.iframes++;
    else if (el.tagName.includes('-')) out.possibleClosedRoots++;
  });
}

export function collectFields(doc: Document): CollectResult {
  const out: CollectResult = { elements: new Set(), possibleClosedRoots: 0, iframes: 0 };
  collect(doc, out);
  return out;
}

export function isContentEditable(el: Element): boolean {
  const value = el.getAttribute('contenteditable');
  return value === 'true' || value === '';
}

export function elementTag(el: Element): 'input' | 'textarea' | 'select' | 'other' {
  // Tag-name based (instead of instanceof) so the logic works across
  // realms: different jsdom documents in tests, iframes, etc.
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') return 'input';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  return 'other';
}

export function isFillable(el: Element): boolean {
  if (isCombobox(el)) {
    return !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true';
  }
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) return false;
    if (el.hasAttribute('disabled') || el.hasAttribute('readonly')) return false;
    return true;
  }
  if (tag === 'select' || tag === 'textarea') {
    return !el.hasAttribute('disabled');
  }
  return isContentEditable(el);
}

/**
 * Custom ARIA combobox widgets ([role="combobox"] — Radix UI,
 * React-Select, Headless UI, …) behave like select fields and are
 * filled through keyboard/value-change simulation.
 */
export function isCombobox(el: Element): boolean {
  return el.getAttribute('role') === 'combobox';
}

/**
 * Collects the `[role="option"]` elements of an ARIA combobox from its
 * associated listbox. The listbox is resolved via `aria-controls` /
 * `aria-owns` (root-aware, so portal-rendered menus in the same
 * document still resolve), falling back to a nested listbox.
 */
export function comboboxOptionElements(el: Element): HTMLElement[] {
  const root = rootNodeOf(el);
  for (const attr of ['aria-controls', 'aria-owns']) {
    const id = el.getAttribute(attr);
    if (!id) continue;
    const listbox = findByIdInRoot(root, id);
    if (!listbox) continue;
    const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
    if (options.length > 0) return options;
  }
  const nested = el.querySelector('[role="listbox"]');
  if (nested) return Array.from(nested.querySelectorAll<HTMLElement>('[role="option"]'));
  return [];
}

/** Password fields and similar are counted but never exposed for filling. */
export function isSensitive(el: Element): boolean {
  if (
    el.tagName.toLowerCase() === 'input' &&
    (el.getAttribute('type') ?? '').toLowerCase() === 'password'
  ) {
    return true;
  }
  const autocomplete = el.getAttribute('autocomplete');
  return autocomplete === 'new-password' || autocomplete === 'current-password';
}

export function isVisible(el: Element): boolean {
  const candidate = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof candidate.checkVisibility === 'function') {
    return candidate.checkVisibility();
  }
  return true;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Resolves an id inside the element's own tree (document or shadow root). */
function findByIdInRoot(root: Document | ShadowRoot, id: string): Element | null {
  const doc = root as Document;
  if (typeof doc.getElementById === 'function') return doc.getElementById(id);
  try {
    return root.querySelector(`#${CSS.escape(id)}`);
  } catch {
    return root.querySelector(`#${id.replace(/([^\w-])/g, '\\$1')}`);
  }
}

function rootNodeOf(el: Element): Document | ShadowRoot {
  return el.getRootNode() as Document | ShadowRoot;
}

export function ariaLabelledByText(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  // Resolve within the element's own root so labels inside the same
  // open shadow root are found (document.getElementById cannot see them).
  const root = rootNodeOf(el);
  const parts = ids
    .split(/\s+/)
    .map((id) => findByIdInRoot(root, id)?.textContent ?? '')
    .filter(Boolean);
  return collapseWhitespace(parts.join(' '));
}

export function resolveLabelText(el: Element): string {
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    return collapseWhitespace((labels[0] as HTMLLabelElement).textContent ?? '');
  }
  const wrapping = el.closest('label');
  if (wrapping) return collapseWhitespace(wrapping.textContent ?? '');
  return '';
}

/** Last-resort textual hint: the text of the previous visible sibling. */
export function nearbyText(el: Element): string {
  let node: Element | null = el.previousElementSibling;
  for (let i = 0; node && i < 3; i++) {
    const text = collapseWhitespace(node.textContent ?? '');
    if (text) return text.slice(0, 120);
    node = node.previousElementSibling;
  }
  return '';
}

export function formContext(el: Element): { formName?: string; formId?: string; legend?: string } {
  const form = findForm(el);
  const fieldset = el.closest('fieldset');
  const legend = fieldset?.querySelector('legend');
  return {
    formName: form?.getAttribute('name') ?? undefined,
    formId: form?.id || undefined,
    legend: legend ? collapseWhitespace(legend.textContent ?? '') : undefined,
  };
}

/**
 * Finds the owning <form>, piercing open shadow roots: a control inside
 * a shadow root can belong to a form rendered in the host's light DOM
 * (form-associated custom elements, portal-style widgets).
 */
function findForm(el: Element): HTMLFormElement | null {
  const direct = (el as HTMLInputElement).form ?? el.closest('form');
  if (direct) return direct;
  let node: Element | null = el;
  while (node) {
    const root = rootNodeOf(node);
    if (root.nodeType === 9) break; // reached the document
    const host = (root as ShadowRoot).host;
    if (!host) break;
    const hostForm = host.closest('form');
    if (hostForm) return hostForm;
    node = host;
  }
  return null;
}
