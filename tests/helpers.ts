import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { JSDOM } from 'jsdom';

const FIXTURES_DIR = resolve(process.cwd(), 'fixtures');

/** Loads a static fixture into a standalone jsdom document. */
export function loadFixture(name: string): Document {
  const html = readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
  return new JSDOM(html).window.document;
}

/**
 * Loads a fixture with inline scripts executed (runScripts:
 * 'dangerously') and waits briefly for DOMContentLoaded + timers, so
 * dynamically rendered content exists.
 */
export async function loadFixtureLive(name: string, waitMs = 200): Promise<Document> {
  const html = readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://fixtures.example.test/' });
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return dom.window.document;
}

export function fieldBySelector(doc: Document, selector: string): Element {
  const el = doc.querySelector(selector);
  if (!el) throw new Error(`Fixture element not found: ${selector}`);
  return el;
}
