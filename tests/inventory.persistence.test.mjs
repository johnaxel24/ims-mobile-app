import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createStock, editStockInSnapshot, summarizeStock } from '../.test-build/inventory.logic.js';
import { createInventoryStorage, INVENTORY_STORAGE_KEY } from '../.test-build/inventory.persistence.js';
import { seedDemoInventory } from '../.test-build/inventory.seed.js';

function memoryDriver() {
  const data = new Map();
  return { data, getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
}

const stock = createStock({ name: 'Rice', quantity: 20, location: 'Shelf A', costPerUnitMinor: 1500, quantityAlertThreshold: 5, notes: '', inventoryDate: '2026-10-22' }, 'rice', '2026-10-22T10:00:00.000Z');
const snapshot = { version: 3, stocks: [stock], locations: ['Shelf A'], quantityHistory: [] };

test('new devices start with an empty inventory and no writes', async () => {
  const driver = memoryDriver();
  assert.deepEqual(await createInventoryStorage(driver).load(), { version: 3, stocks: [], locations: [], quantityHistory: [] });
  assert.equal(driver.data.size, 0);
});

test('a new storage instance reloads saved records without derived fields', async () => {
  const driver = memoryDriver();
  await createInventoryStorage(driver).save({ ...snapshot, stocks: [summarizeStock(stock)] });
  assert.deepEqual(await createInventoryStorage(driver).load(), snapshot);
  const saved = JSON.parse(driver.data.get(INVENTORY_STORAGE_KEY));
  assert.equal(saved.version, 3);
  assert.equal('totalAcquisitionCostMinor' in saved.stocks[0], false);
  assert.equal('isLowStock' in saved.stocks[0], false);
});

test('invalid stored data is preserved and never silently overwritten', async () => {
  const driver = memoryDriver();
  driver.data.set(INVENTORY_STORAGE_KEY, '{invalid');
  await assert.rejects(createInventoryStorage(driver).load(), /could not be read/);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), '{invalid');
});

test('read errors are surfaced to the caller', async () => {
  const storage = createInventoryStorage({ getItem: async () => { throw new Error('Read unavailable'); }, setItem: async () => {} });
  await assert.rejects(storage.load(), /Read unavailable/);
});

test('failed saves reject and preserve the prior stored snapshot', async () => {
  const driver = memoryDriver();
  await createInventoryStorage(driver).save(snapshot);
  const before = driver.data.get(INVENTORY_STORAGE_KEY);
  const storage = createInventoryStorage({ ...driver, setItem: async () => { throw new Error('Storage full'); } });
  await assert.rejects(storage.save({ ...snapshot, stocks: [{ ...stock, quantity: 3 }] }), /Storage full/);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), before);
  assert.deepEqual(await storage.load(), snapshot);
});

test('invalid snapshots are rejected before a storage write', async () => {
  const driver = memoryDriver();
  const storage = createInventoryStorage(driver);
  await assert.rejects(storage.save({ ...snapshot, stocks: [{ ...stock, quantity: -1 }] }));
  await assert.rejects(storage.save({ ...snapshot, stocks: [stock, stock] }));
  assert.equal(driver.data.size, 0);
});

test('locations persist without requiring a stock record', async () => {
  const driver = memoryDriver();
  const locationsOnly = { version: 3, stocks: [], locations: ['Shelf A', 'Storage room'], quantityHistory: [] };
  await createInventoryStorage(driver).save(locationsOnly);
  assert.deepEqual(await createInventoryStorage(driver).load(), locationsOnly);
});

test('legacy data loads without a write and migrates at the original key on the next save', async () => {
  const driver = memoryDriver();
  const legacyStock = { ...stock };
  delete legacyStock.created_at;
  delete legacyStock.measurementPerUnit;
  const legacyJson = JSON.stringify({ version: 1, stocks: [legacyStock] });
  driver.data.set(INVENTORY_STORAGE_KEY, legacyJson);
  const storage = createInventoryStorage(driver);
  const migrated = await storage.load();
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), legacyJson);
  assert.deepEqual(migrated, snapshot);
  await storage.save(migrated);
  assert.equal(JSON.parse(driver.data.get(INVENTORY_STORAGE_KEY)).version, 3);
  assert.equal(driver.data.size, 1);
});

test('initialization adds samples exactly once across storage instances and repeated openings', async () => {
  const driver = memoryDriver();
  let writes = 0;
  const trackedDriver = { ...driver, setItem: async (key, value) => { writes += 1; await driver.setItem(key, value); } };
  const first = await createInventoryStorage(trackedDriver).initialize();
  assert.equal(first.stocks.length, 8);
  assert.equal(first.locations.length, 5);
  assert.equal(first.demoSeeded, true);
  assert.equal(writes, 1);
  assert.ok(first.stocks.some((record) => record.quantity === 0));
  assert.ok(first.stocks.some((record) => record.quantity === record.quantityAlertThreshold));
  assert.ok(first.stocks.some((record) => record.quantity > record.quantityAlertThreshold));
  assert.ok(first.stocks.some((record) => record.costPerUnitMinor === null && record.measurementPerUnit === null));
  const nextStorage = createInventoryStorage(trackedDriver);
  assert.deepEqual(await nextStorage.initialize(), first);
  assert.deepEqual(await nextStorage.initialize(), first);
  assert.equal(writes, 1);
  assert.equal(JSON.parse(driver.data.get(INVENTORY_STORAGE_KEY)).demoSeeded, true);
});

test('sample initialization preserves existing stock and reuses locations', async () => {
  const driver = memoryDriver();
  const existing = { ...snapshot, locations: ['shelf a'] };
  await createInventoryStorage(driver).save(existing);
  const seeded = await createInventoryStorage(driver).initialize();
  assert.equal(seeded.stocks.length, 9);
  assert.deepEqual(seeded.stocks.find((record) => record.id === stock.id), stock);
  assert.equal(seeded.locations.filter((location) => location.toLowerCase() === 'shelf a').length, 1);
  assert.ok(seeded.stocks.filter((record) => record.id.startsWith('demo-') && record.location.toLowerCase() === 'shelf a').every((record) => record.location === 'shelf a'));
});

test('later openings preserve edits to demo stock instead of reseeding', async () => {
  const driver = memoryDriver();
  const storage = createInventoryStorage(driver);
  const first = await storage.initialize();
  const edited = { ...first, stocks: first.stocks.map((record, index) => index === 0 ? { ...record, quantity: 99, notes: 'Keep my changes' } : record) };
  await storage.save(edited);
  assert.deepEqual(await storage.initialize(), edited);
  assert.deepEqual(await createInventoryStorage(driver).initialize(), edited);
});

test('a completion flag prevents seeding even when the stock list is empty', async () => {
  const driver = memoryDriver();
  const emptySeeded = { version: 3, stocks: [], locations: [], quantityHistory: [], demoSeeded: true };
  await createInventoryStorage(driver).save(emptySeeded);
  const before = driver.data.get(INVENTORY_STORAGE_KEY);
  assert.deepEqual(await createInventoryStorage(driver).initialize(), emptySeeded);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), before);
});

test('a failed initial seed save preserves existing data and can be retried once', async () => {
  const driver = memoryDriver();
  await createInventoryStorage(driver).save(snapshot);
  const before = driver.data.get(INVENTORY_STORAGE_KEY);
  let failWrite = true;
  const storage = createInventoryStorage({
    ...driver,
    setItem: async (key, value) => {
      if (failWrite) throw new Error('Storage full');
      await driver.setItem(key, value);
    },
  });
  await assert.rejects(storage.initialize(), /Storage full/);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), before);
  failWrite = false;
  const seeded = await storage.initialize();
  assert.equal(seeded.stocks.length, 9);
  assert.equal(seeded.demoSeeded, true);
  assert.deepEqual(await storage.initialize(), seeded);
});

test('concurrent initialization shares a single seed write', async () => {
  const driver = memoryDriver();
  let writes = 0;
  const storage = createInventoryStorage({ ...driver, setItem: async (key, value) => { writes += 1; await driver.setItem(key, value); } });
  const first = storage.initialize();
  const second = storage.initialize();
  assert.equal(first, second);
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.equal(writes, 1);
});

test('invalid data or seed flags block initialization without overwriting stored inventory', async () => {
  const driver = memoryDriver();
  for (const json of ['{invalid', JSON.stringify({ ...snapshot, demoSeeded: 'true' })]) {
    driver.data.set(INVENTORY_STORAGE_KEY, json);
    await assert.rejects(createInventoryStorage(driver).initialize());
    assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), json);
  }
});

test('stable demo IDs protect existing records even if the seed flag is missing', () => {
  const first = seedDemoInventory({ version: 3, stocks: [], locations: [], quantityHistory: [] }, new Date('2026-10-22T12:00:00.000Z'));
  const edited = { ...first, demoSeeded: false, stocks: first.stocks.map((record, index) => index === 0 ? { ...record, quantity: 77, notes: 'Preserve me' } : record) };
  const restored = seedDemoInventory(edited, new Date('2026-10-23T12:00:00.000Z'));
  assert.deepEqual(restored.stocks, edited.stocks);
  assert.equal(restored.demoSeeded, true);
  assert.equal(seedDemoInventory(restored), restored);
});

test('v2 inventory migrates in memory without rewriting or reseeding existing samples', async () => {
  const driver = memoryDriver();
  const legacy = { version: 2, stocks: [stock], locations: ['Shelf A'], demoSeeded: true };
  const json = JSON.stringify(legacy);
  driver.data.set(INVENTORY_STORAGE_KEY, json);
  const storage = createInventoryStorage(driver);
  const migrated = await storage.initialize();
  assert.deepEqual(migrated, { ...snapshot, demoSeeded: true });
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), json);
  const changed = editStockInSnapshot(migrated, 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Sold' }, '2026-10-22T11:00:00.000Z').snapshot;
  await storage.save(changed);
  assert.deepEqual(await createInventoryStorage(driver).initialize(), changed);
});

test('stock quantity and history persist in exactly one write and reload together', async () => {
  const driver = memoryDriver();
  await createInventoryStorage(driver).save(snapshot);
  let writes = 0;
  const storage = createInventoryStorage({ ...driver, setItem: async (key, value) => { writes += 1; await driver.setItem(key, value); } });
  const changed = editStockInSnapshot(await storage.load(), 'rice', { quantity: 0, notes: 'Empty', quantityChangeReason: 'Sold', quantityChangeExplanation: 'Last units sold' }, '2026-10-22T11:00:00.000Z').snapshot;
  await storage.save(changed);
  assert.equal(writes, 1);
  assert.deepEqual(await createInventoryStorage(driver).load(), changed);
  assert.equal(changed.quantityHistory[0].previousQuantity, 20);
  assert.equal(changed.quantityHistory[0].newQuantity, 0);
});

test('failed quantity saves preserve both the previous quantity and previous history; retry adds once', async () => {
  const driver = memoryDriver();
  const storage = createInventoryStorage(driver);
  await storage.save(snapshot);
  const before = driver.data.get(INVENTORY_STORAGE_KEY);
  const changed = editStockInSnapshot(snapshot, 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Sold' }, '2026-10-22T11:00:00.000Z').snapshot;
  const failing = createInventoryStorage({ ...driver, setItem: async () => { throw new Error('Storage full'); } });
  await assert.rejects(failing.save(changed), /Storage full/);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), before);
  assert.deepEqual(await storage.load(), snapshot);
  await storage.save(changed);
  assert.deepEqual(await storage.load(), changed);
  assert.equal((await storage.load()).quantityHistory.length, 1);
});

test('invalid persisted history blocks initialization without overwriting inventory', async () => {
  const driver = memoryDriver();
  const json = JSON.stringify({ ...snapshot, quantityHistory: [{ id: 'broken' }] });
  driver.data.set(INVENTORY_STORAGE_KEY, json);
  await assert.rejects(createInventoryStorage(driver).initialize(), /history/);
  assert.equal(driver.data.get(INVENTORY_STORAGE_KEY), json);
});

test('one-time sample initialization preserves already recorded quantity history', async () => {
  const driver = memoryDriver();
  const changed = editStockInSnapshot(snapshot, 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Sold' }, '2026-10-22T11:00:00.000Z').snapshot;
  await createInventoryStorage(driver).save(changed);
  const seeded = await createInventoryStorage(driver).initialize();
  assert.equal(seeded.stocks.length, 9);
  assert.deepEqual(seeded.quantityHistory, changed.quantityHistory);
  assert.deepEqual(await createInventoryStorage(driver).initialize(), seeded);
});

test('corrected details and received date persist without changing creation time or adding quantity history', async () => {
  const driver = memoryDriver();
  const storage = createInventoryStorage(driver);
  const original = { ...snapshot, locations: ['Shelf A', 'Shelf B'] };
  const edited = editStockInSnapshot(original, stock.id, {
    name: 'Premium rice', location: 'shelf b', quantity: stock.quantity,
    costPerUnitMinor: null, measurementPerUnit: '2 kg', quantityAlertThreshold: 30, notes: 'Relocated',
    inventoryDate: '2026-10-23',
  }, '2026-10-23T10:00:00.000Z').snapshot;
  await storage.save(edited);
  const reopened = await createInventoryStorage(driver).load();
  assert.deepEqual(reopened, edited);
  assert.equal(reopened.stocks[0].inventoryDate, '2026-10-23');
  assert.equal(reopened.stocks[0].created_at, stock.created_at);
  assert.equal(reopened.stocks[0].location, 'Shelf B');
  assert.equal(reopened.stocks[0].costPerUnitMinor, null);
  assert.deepEqual(reopened.quantityHistory, []);
});

test('a failed combined details and quantity save preserves all prior fields and history', async () => {
  const driver = memoryDriver();
  const storage = createInventoryStorage(driver);
  await storage.save(snapshot);
  const edited = editStockInSnapshot(snapshot, stock.id, {
    name: 'Corrected rice', quantity: 12, costPerUnitMinor: 1800, measurementPerUnit: '1 kg',
    quantityAlertThreshold: 15, notes: 'New note', inventoryDate: '2026-10-23', quantityChangeReason: 'Sold',
  }, '2026-10-23T10:00:00.000Z').snapshot;
  const failing = createInventoryStorage({ ...driver, setItem: async () => { throw new Error('Storage full'); } });
  await assert.rejects(failing.save(edited), /Storage full/);
  assert.deepEqual(await storage.load(), snapshot);
  await storage.save(edited);
  assert.deepEqual(await storage.load(), edited);
  assert.equal((await storage.load()).quantityHistory.length, 1);
});
