import type { FillMode } from '../domain/messages';
import type { Persona } from '../domain/persona';
import type { Scenario } from '../domain/scenario';
import type { FormTemplate } from '../domain/template';

export interface Settings {
  activePersonaId?: string;
  activeScenarioId?: string;
  autoScan: boolean;
  fillMode: FillMode;
  badgeEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoScan: true,
  fillMode: 'overwrite',
  badgeEnabled: true,
};

export type ActionKind = 'fill' | 'template' | 'persona' | 'scenario';

export interface RecentAction {
  id: string;
  at: number;
  kind: ActionKind;
  /** Counts and labels only — never persona values. */
  summary: string;
}

/**
 * Storage abstraction. v0.1 ships chrome.storage.local; the same
 * interface backs preview mode (localStorage) and tests (memory), and
 * leaves room for an optional sync backend later.
 */
export interface StorageService {
  getPersonas(): Promise<Persona[]>;
  savePersona(persona: Persona): Promise<void>;
  deletePersona(id: string): Promise<void>;

  getTemplates(): Promise<FormTemplate[]>;
  saveTemplate(template: FormTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  getScenarios(): Promise<Scenario[]>;
  saveScenario(scenario: Scenario): Promise<void>;
  deleteScenario(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  getRecentActions(): Promise<RecentAction[]>;
  pushRecentAction(action: RecentAction): Promise<void>;

  clearAll(): Promise<void>;
}
