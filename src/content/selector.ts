const SHADOW_SEPARATOR = ' >>> ';

function escapeId(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/([^\w-])/g, '\\$1');
}

function escapeAttr(value: string): string {
  return value.replace(/(["\\])/g, '\\$1');
}

function nthOfType(el: Element, tag: string): number {
  let count = 0;
  let node: Element | null = el;
  while (node) {
    if (node.tagName.toLowerCase() === tag) count++;
    node = node.previousElementSibling;
  }
  return count;
}

function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${escapeId(el.id)}`;
  const name = el.getAttribute('name');
  const nth = `:nth-of-type(${nthOfType(el, tag)})`;
  if (name) return `${tag}[name="${escapeAttr(name)}"]${nth}`;
  return `${tag}${nth}`;
}

function buildWithinRoot(el: Element, root: Document | ShadowRoot): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.getRootNode() === root) {
    parts.unshift(segmentFor(node));
    if (node.id) break; // ids are unique within their root
    node = node.parentElement;
  }
  return parts.join(' > ');
}

/**
 * Builds a stable selector for an element. Elements inside open shadow
 * roots produce a piercing selector: `host-path >>> inner-path`.
 */
export function buildSelector(el: Element): string {
  const root = el.getRootNode();
  // nodeType 9 = DOCUMENT_NODE (realm-independent check, unlike instanceof)
  if (root.nodeType === 9) return buildWithinRoot(el, root as Document);
  const host = (root as ShadowRoot).host;
  return `${buildSelector(host)}${SHADOW_SEPARATOR}${buildWithinRoot(el, root as ShadowRoot)}`;
}

/**
 * Resolves a ProfilePack selector (including " >>> " shadow piercing)
 * against the given root document. Returns null when the element is
 * gone or the shadow root is closed.
 */
export function resolveSelector(selector: string, doc: Document = document): Element | null {
  const parts = selector.split(SHADOW_SEPARATOR).map((p) => p.trim());
  let root: Document | ShadowRoot = doc;
  let current: Element | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) return null;
    current = root.querySelector(part);
    if (!current) return null;
    if (i < parts.length - 1) {
      const nextRoot: ShadowRoot | null = (current as HTMLElement).shadowRoot;
      if (!nextRoot) return null; // closed shadow root
      root = nextRoot;
    }
  }
  return current;
}
