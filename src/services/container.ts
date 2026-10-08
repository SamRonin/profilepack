import { LocalStorageKV } from '../storage/localStorageKv';
import { ChromeKV } from '../storage/chromeKv';
import { KVStorageService } from '../storage/kvStorageService';
import type { StorageService } from '../storage/types';
import { isExtensionEnvironment } from '../shared/browserApi';

/**
 * Storage backend selection:
 * - inside the extension: chrome.storage.local (local-first default)
 * - preview mode (UI opened outside Chrome): localStorage so the whole
 *   UI stays usable during development; clearly not synced anywhere.
 */
export const storage: StorageService = isExtensionEnvironment
  ? new KVStorageService(new ChromeKV())
  : new KVStorageService(new LocalStorageKV());
