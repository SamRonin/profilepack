import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KVStorageService } from '../src/storage/kvStorageService';
import { MemoryKV } from '../src/storage/memoryKv';
import { ChromeKV } from '../src/storage/chromeKv';
import { createId } from '../src/shared/id';
import { generatePersona } from '../src/domain/generator';
import { DEFAULT_SETTINGS, type RecentAction } from '../src/storage/types';
import type { FormTemplate } from '../src/domain/template';

describe('KVStorageService (memory backend)', () => {
  let storage: KVStorageService;

  beforeEach(() => {
    storage = new KVStorageService(new MemoryKV());
  });

  it('saves, updates and deletes personas', async () => {
    const persona = generatePersona('de', { seed: 1 });
    await storage.savePersona(persona);
    expect(await storage.getPersonas()).toHaveLength(1);

    const renamed = { ...persona, name: 'Renamed' };
    await storage.savePersona(renamed);
    const personas = await storage.getPersonas();
    expect(personas).toHaveLength(1);
    expect(personas[0]?.name).toBe('Renamed');

    await storage.deletePersona(persona.id);
    expect(await storage.getPersonas()).toHaveLength(0);
  });

  it('persists templates', async () => {
    const template: FormTemplate = {
      id: createId('template'),
      name: 'Checkout',
      hostname: 'shop.example.test',
      mappings: [],
      createdAt: 1,
      updatedAt: 1,
    };
    await storage.saveTemplate(template);
    expect((await storage.getTemplates())[0]?.name).toBe('Checkout');

    await storage.deleteTemplate(template.id);
    expect(await storage.getTemplates()).toHaveLength(0);
  });

  it('merges stored settings with defaults', async () => {
    const settings = await storage.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);

    await storage.saveSettings({ ...settings, autoScan: false });
    expect((await storage.getSettings()).autoScan).toBe(false);
    expect((await storage.getSettings()).fillMode).toBe('overwrite');
  });

  it('caps recent actions at 20 (newest first)', async () => {
    for (let i = 0; i < 25; i++) {
      const action: RecentAction = {
        id: `a${i}`,
        at: i,
        kind: 'fill',
        summary: `action ${i}`,
      };
      await storage.pushRecentAction(action);
    }
    const actions = await storage.getRecentActions();
    expect(actions).toHaveLength(20);
    expect(actions[0]?.summary).toBe('action 24');
    expect(actions[19]?.summary).toBe('action 5');
  });

  it('clearAll removes every ProfilePack key', async () => {
    await storage.savePersona(generatePersona('us', { seed: 2 }));
    await storage.clearAll();
    expect(await storage.getPersonas()).toHaveLength(0);
  });
});

describe('ChromeKV backend (chrome.storage.local contract)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads, writes and removes via chrome.storage.local', async () => {
    const map = new Map<string, unknown>();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: map.get(key) }),
          set: async (obj: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(obj)) map.set(k, structuredClone(v));
          },
          remove: async (key: string) => {
            map.delete(key);
          },
        },
      },
    });

    const kv = new ChromeKV();
    expect(await kv.get<string>('missing')).toBeUndefined();
    await kv.set<string>('pp:test', 'hello');
    expect(await kv.get<string>('pp:test')).toBe('hello');
    await kv.remove('pp:test');
    expect(await kv.get<string>('pp:test')).toBeUndefined();
  });
});
