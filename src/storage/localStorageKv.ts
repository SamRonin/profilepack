import type { KeyValueBackend } from './kvStorageService';

/**
 * localStorage backend used in preview mode (extension pages opened
 * outside Chrome, e.g. for UI development). Data is clearly scoped
 * under the given prefix and never leaves the browser.
 */
export class LocalStorageKV implements KeyValueBackend {
  constructor(private readonly prefix = 'pp:') {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = window.localStorage.getItem(this.prefix + key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    window.localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    window.localStorage.removeItem(this.prefix + key);
  }
}
