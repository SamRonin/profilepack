import { generatePersona, randomSeed, type GenerateOptions } from '../domain/generator';
import type { PresetId } from '../domain/generatorData';
import type { Persona, PersonaData } from '../domain/persona';
import type { Scenario } from '../domain/scenario';
import { createId } from '../shared/id';
import type { StorageService } from '../storage/types';

export async function listPersonas(storage: StorageService): Promise<Persona[]> {
  return (await storage.getPersonas()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActivePersona(storage: StorageService): Promise<Persona | null> {
  const settings = await storage.getSettings();
  if (!settings.activePersonaId) return null;
  const personas = await storage.getPersonas();
  return personas.find((p) => p.id === settings.activePersonaId) ?? null;
}

export async function activatePersona(storage: StorageService, id: string): Promise<void> {
  const settings = await storage.getSettings();
  await storage.saveSettings({ ...settings, activePersonaId: id });
  const personas = await storage.getPersonas();
  const persona = personas.find((p) => p.id === id);
  await pushPersonaAction(
    storage,
    persona ? `Persona activated (${persona.name})` : 'Persona activated',
  );
}

export async function createPersonaFromPreset(
  storage: StorageService,
  presetId: PresetId,
  options: GenerateOptions = {},
): Promise<Persona> {
  const persona = generatePersona(presetId, { seed: options.seed ?? randomSeed() });
  await storage.savePersona(persona);
  await pushPersonaAction(storage, `Persona created from preset (${presetId.toUpperCase()})`);
  return persona;
}

export async function savePersona(storage: StorageService, persona: Persona): Promise<Persona> {
  const updated: Persona = { ...persona, updatedAt: Date.now() };
  await storage.savePersona(updated);
  await pushPersonaAction(storage, 'Persona saved');
  return updated;
}

export async function duplicatePersona(
  storage: StorageService,
  id: string,
): Promise<Persona | null> {
  const personas = await storage.getPersonas();
  const source = personas.find((p) => p.id === id);
  if (!source) return null;
  const now = Date.now();
  const copy: Persona = {
    ...structuredClone(source),
    id: createId('persona'),
    name: `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await storage.savePersona(copy);
  await pushPersonaAction(storage, 'Persona duplicated');
  return copy;
}

export async function deletePersona(storage: StorageService, id: string): Promise<void> {
  await storage.deletePersona(id);
  const settings = await storage.getSettings();
  if (settings.activePersonaId === id) {
    await storage.saveSettings({ ...settings, activePersonaId: undefined });
  }
  const scenarios = await storage.getScenarios();
  for (const scenario of scenarios.filter((s) => s.personaId === id)) {
    await storage.deleteScenario(scenario.id);
    if (settings.activeScenarioId === scenario.id) {
      const next = await storage.getSettings();
      await storage.saveSettings({ ...next, activeScenarioId: undefined });
    }
  }
  await pushPersonaAction(storage, 'Persona deleted');
}

/**
 * Applies scenario-level overrides (country) on top of persona data
 * without mutating the stored persona.
 */
export function applyScenario(persona: Persona, scenario: Scenario | null): Persona {
  if (!scenario || !scenario.country || scenario.country === persona.country) return persona;
  const data: PersonaData = {
    ...persona.data,
    address: { ...persona.data.address, country: scenario.country },
  };
  return { ...persona, data };
}

async function pushPersonaAction(storage: StorageService, summary: string): Promise<void> {
  await storage.pushRecentAction({
    id: createId('action'),
    at: Date.now(),
    kind: 'persona',
    summary,
  });
}
