import type { Scenario } from '../domain/scenario';
import { createId } from '../shared/id';
import type { StorageService } from '../storage/types';

export async function listScenarios(storage: StorageService): Promise<Scenario[]> {
  return (await storage.getScenarios()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveScenario(
  storage: StorageService,
  scenario: Omit<Scenario, 'id' | 'createdAt'> & Partial<Pick<Scenario, 'id' | 'createdAt'>>,
): Promise<Scenario> {
  const saved: Scenario = {
    ...scenario,
    id: scenario.id || createId('scenario'),
    createdAt: scenario.createdAt ?? Date.now(),
  };
  await storage.saveScenario(saved);
  await storage.pushRecentAction({
    id: createId('action'),
    at: Date.now(),
    kind: 'scenario',
    summary: `Scenario saved (${saved.name})`,
  });
  return saved;
}

export async function deleteScenario(storage: StorageService, id: string): Promise<void> {
  await storage.deleteScenario(id);
  const settings = await storage.getSettings();
  if (settings.activeScenarioId === id) {
    await storage.saveSettings({ ...settings, activeScenarioId: undefined });
  }
}

export async function activateScenario(
  storage: StorageService,
  id: string | undefined,
): Promise<void> {
  const settings = await storage.getSettings();
  await storage.saveSettings({ ...settings, activeScenarioId: id });
}
