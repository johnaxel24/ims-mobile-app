import { parseSnapshot } from './inventory.snapshot';
import type { InventorySnapshot } from './inventory.types';

// Retain the original key so v1 records remain discoverable during schema migration.
export const INVENTORY_STORAGE_KEY = '@stockroom/inventory/v1';

export interface StorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

/** Driver injection allows storage failure tests without loading native modules. */
export function createInventoryStorage(driver: StorageDriver) {
  let initialization: Promise<InventorySnapshot> | null = null;
  const storage = {
    async load(): Promise<InventorySnapshot> {
      const json = await driver.getItem(INVENTORY_STORAGE_KEY);
      return json === null ? { version: 5, stocks: [], locations: [], quantityHistory: [] } : parseSnapshot(json);
    },
    async save(snapshot: InventorySnapshot): Promise<void> {
      // Round-trip validation drops derived fields and rejects invalid snapshots before writing.
      const validated = parseSnapshot(JSON.stringify(snapshot));
      await driver.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(validated));
    },
    initialize(): Promise<InventorySnapshot> {
      if (initialization) return initialization;
      // Share concurrent initialization and reset the lock after success or failure.
      initialization = (async () => {
        try {
          // Opening the app only reads existing data; new devices stay empty.
          return await storage.load();
        } finally {
          initialization = null;
        }
      })();
      return initialization;
    },
  };
  return storage;
}
