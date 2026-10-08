import { DEFAULT_SETTINGS, type Settings, type StorageService } from '../storage/types';

export async function getSettings(storage: StorageService): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await storage.getSettings()) };
}

export async function saveSettings(storage: StorageService, settings: Settings): Promise<void> {
  await storage.saveSettings(settings);
}

export async function updateSettings(
  storage: StorageService,
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings(storage);
  const next: Settings = { ...current, ...patch };
  await storage.saveSettings(next);
  return next;
}
