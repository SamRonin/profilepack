import type { Persona } from '../domain/persona';
import type { Scenario } from '../domain/scenario';
import type { FormTemplate } from '../domain/template';
import { STORAGE_KEYS } from './keys';
import { DEFAULT_SETTINGS, type RecentAction, type Settings, type StorageService } from './types';

/** Minimal async key/value backend used by all storage implementations. */
export interface KeyValueBackend {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const MAX_RECENT_ACTIONS = 20;

/**
 * StorageService built on top of a simple KV backend. All three
 * backends (chrome.storage.local, localStorage preview, in-memory
 * tests) share this implementation so behaviour stays identical.
 */
export class KVStorageService implements StorageService {
  constructor(private readonly backend: KeyValueBackend) {}

  async getPersonas(): Promise<Persona[]> {
    return (await this.backend.get<Persona[]>(STORAGE_KEYS.personas)) ?? [];
  }

  async savePersona(persona: Persona): Promise<void> {
    const personas = await this.getPersonas();
    const index = personas.findIndex((p) => p.id === persona.id);
    if (index >= 0) personas[index] = persona;
    else personas.push(persona);
    await this.backend.set(STORAGE_KEYS.personas, personas);
  }

  async deletePersona(id: string): Promise<void> {
    const personas = await this.getPersonas();
    await this.backend.set(
      STORAGE_KEYS.personas,
      personas.filter((p) => p.id !== id),
    );
  }

  async getTemplates(): Promise<FormTemplate[]> {
    return (await this.backend.get<FormTemplate[]>(STORAGE_KEYS.templates)) ?? [];
  }

  async saveTemplate(template: FormTemplate): Promise<void> {
    const templates = await this.getTemplates();
    const index = templates.findIndex((t) => t.id === template.id);
    if (index >= 0) templates[index] = template;
    else templates.push(template);
    await this.backend.set(STORAGE_KEYS.templates, templates);
  }

  async deleteTemplate(id: string): Promise<void> {
    const templates = await this.getTemplates();
    await this.backend.set(
      STORAGE_KEYS.templates,
      templates.filter((t) => t.id !== id),
    );
  }

  async getScenarios(): Promise<Scenario[]> {
    return (await this.backend.get<Scenario[]>(STORAGE_KEYS.scenarios)) ?? [];
  }

  async saveScenario(scenario: Scenario): Promise<void> {
    const scenarios = await this.getScenarios();
    const index = scenarios.findIndex((s) => s.id === scenario.id);
    if (index >= 0) scenarios[index] = scenario;
    else scenarios.push(scenario);
    await this.backend.set(STORAGE_KEYS.scenarios, scenarios);
  }

  async deleteScenario(id: string): Promise<void> {
    const scenarios = await this.getScenarios();
    await this.backend.set(
      STORAGE_KEYS.scenarios,
      scenarios.filter((s) => s.id !== id),
    );
  }

  async getSettings(): Promise<Settings> {
    const stored = await this.backend.get<Partial<Settings>>(STORAGE_KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.backend.set(STORAGE_KEYS.settings, settings);
  }

  async getRecentActions(): Promise<RecentAction[]> {
    return (await this.backend.get<RecentAction[]>(STORAGE_KEYS.recentActions)) ?? [];
  }

  async pushRecentAction(action: RecentAction): Promise<void> {
    const actions = await this.getRecentActions();
    actions.unshift(action);
    await this.backend.set(STORAGE_KEYS.recentActions, actions.slice(0, MAX_RECENT_ACTIONS));
  }

  async clearAll(): Promise<void> {
    await Promise.all(Object.values(STORAGE_KEYS).map((key) => this.backend.remove(key)));
  }
}
