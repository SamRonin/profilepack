import type { KeyValueBackend } from './kvStorageService';

/** In-memory backend for unit tests. */
export class MemoryKV implements KeyValueBackend {
  private readonly map = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.has(key) ? (this.map.get(key) as T) : undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
}
