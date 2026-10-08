import { describe, expect, it } from 'vitest';

import {
  pathPatternMatches,
  templateMatchesUrl,
  templateSpecificity,
  type FormTemplate,
} from '../src/domain/template';
import { findTemplateForUrl } from '../src/services/templateService';
import { KVStorageService } from '../src/storage/kvStorageService';
import { MemoryKV } from '../src/storage/memoryKv';

function template(partial: Partial<FormTemplate> = {}): FormTemplate {
  return {
    id: partial.id ?? 't',
    name: partial.name ?? 'Template',
    hostname: partial.hostname,
    pathPattern: partial.pathPattern,
    mappings: partial.mappings ?? [],
    createdAt: 1,
    updatedAt: partial.updatedAt ?? 1,
  };
}

describe('template matching', () => {
  it('matches by hostname case-insensitively', () => {
    const t = template({ hostname: 'Shop.Example.com' });
    expect(templateMatchesUrl(t, new URL('https://shop.example.com/checkout'))).toBe(true);
    expect(templateMatchesUrl(t, new URL('https://other.example.com/checkout'))).toBe(false);
  });

  it('requires both hostname and path pattern when both are set', () => {
    const t = template({ hostname: 'example.com', pathPattern: '/checkout/*' });
    expect(templateMatchesUrl(t, new URL('https://example.com/checkout/step2'))).toBe(true);
    expect(templateMatchesUrl(t, new URL('https://example.com/account'))).toBe(false);
    expect(templateMatchesUrl(t, new URL('https://other.com/checkout/step2'))).toBe(false);
  });

  it('supports glob-lite path patterns', () => {
    expect(pathPatternMatches('/signup/*', '/signup/step/3')).toBe(true);
    expect(pathPatternMatches('/signup', '/signup')).toBe(true);
    expect(pathPatternMatches('/signup', '/signup/extra')).toBe(false);
  });

  it('ranks specificity: hostname+path > hostname > path', () => {
    expect(templateSpecificity(template({ hostname: 'a.com', pathPattern: '/x' }))).toBe(3);
    expect(templateSpecificity(template({ hostname: 'a.com' }))).toBe(2);
    expect(templateSpecificity(template({ pathPattern: '/x' }))).toBe(1);
  });

  it('does not match templates without any scope', () => {
    expect(templateMatchesUrl(template(), new URL('https://example.com/'))).toBe(false);
  });
});

describe('template persistence + selection', () => {
  it('finds the most specific template for a URL', async () => {
    const storage = new KVStorageService(new MemoryKV());
    await storage.saveTemplate(template({ id: 'host-only', hostname: 'shop.test', updatedAt: 1 }));
    await storage.saveTemplate(
      template({ id: 'host-path', hostname: 'shop.test', pathPattern: '/checkout', updatedAt: 1 }),
    );

    const best = findTemplateForUrl(await storage.getTemplates(), 'https://shop.test/checkout');
    expect(best?.id).toBe('host-path');

    const fallback = findTemplateForUrl(await storage.getTemplates(), 'https://shop.test/other');
    expect(fallback?.id).toBe('host-only');

    expect(findTemplateForUrl(await storage.getTemplates(), 'https://elsewhere.test/')).toBeNull();
    expect(findTemplateForUrl(await storage.getTemplates(), 'not a url')).toBeNull();
  });
});
