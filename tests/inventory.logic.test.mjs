import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acquisitionCost, addLocationToSnapshot, buildEditedRecord, createStock, DEFAULT_LIST_OPTIONS, editStockInSnapshot, formatInventoryDate,
  formatMoney, isInventoryDate, isSameLocation, localToday, parseMoney, parseWholeNumber,
  normalizeLocations, selectQuantityHistory, selectStocks, summarizeStock, validateStockForm,
} from '../.test-build/inventory.logic.js';
import { parseSnapshot } from '../.test-build/inventory.snapshot.js';
import { validateStockSubmission } from '../.test-build/inventory.form.js';

const timestamp = '2026-10-22T10:00:00.000Z';
const later = '2026-10-22T11:00:00.000Z';
const input = {
  name: 'Jasmine rice', quantity: 20, location: 'Shelf B', costPerUnitMinor: 1500,
  quantityAlertThreshold: 5, notes: '', inventoryDate: '2026-10-22',
};
const record = (overrides = {}, id = 'rice') => createStock({ ...input, ...overrides }, id, timestamp);
const form = {
  name: input.name, quantity: '20', location: input.location, costPerUnit: '15.00',
  quantityAlertThreshold: '5', notes: '', measurementPerUnit: '', inventoryDate: input.inventoryDate,
};

test('creation trims required text and owns its metadata', () => {
  const stock = createStock({ ...input, name: ' Rice ', location: ' Shelf A ', id: 'injected', lastUpdatedAt: later, created_at: later, totalAcquisitionCostMinor: 999 }, 'real', timestamp);
  assert.equal(stock.name, 'Rice');
  assert.equal(stock.location, 'Shelf A');
  assert.equal(stock.id, 'real');
  assert.equal(stock.lastUpdatedAt, timestamp);
  assert.equal(stock.created_at, timestamp);
  assert.equal('totalAcquisitionCostMinor' in stock, false);
});

test('decimal cost parsing is exact and rejects unsupported money formats', () => {
  assert.equal(parseMoney('15.50'), 1550);
  assert.equal(parseMoney('0.29'), 29);
  assert.equal(parseMoney(' 15.5 '), 1550);
  assert.equal(parseMoney('0'), 0);
  for (const value of ['', '-1', '1.001', '1e2', 'Infinity', 'NaN', '1,000.00', '90071992547409.92']) {
    assert.equal(parseMoney(value), null, value);
  }
});

test('quantity parsing rejects fractions, signs, blank inputs, and unsafe numbers', () => {
  assert.equal(parseWholeNumber(' 0 '), 0);
  assert.equal(parseWholeNumber('24'), 24);
  for (const value of ['', ' ', '-1', '1.5', '1e3', 'Infinity', '9007199254740992']) assert.equal(parseWholeNumber(value), null);
});

test('acquisition total follows current quantity with exact minor units', () => {
  const original = record();
  assert.equal(summarizeStock(original).totalAcquisitionCostMinor, 30000);
  const changed = buildEditedRecord(original, { quantity: 12, notes: '' }, later);
  assert.equal(summarizeStock(changed).totalAcquisitionCostMinor, 18000);
  assert.equal(acquisitionCost(3, 29), 87);
  assert.equal(formatMoney(87), '0.87');
  assert.equal(formatMoney(1550), '15.50');
  assert.equal(formatMoney(30000), '300.00');
  assert.equal(formatMoney(0), '0.00');
});

test('zero costs and quantities are supported; unsafe totals are rejected', () => {
  assert.equal(acquisitionCost(0, 100), 0);
  assert.equal(acquisitionCost(100, 0), 0);
  assert.equal(acquisitionCost(1, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.throws(() => acquisitionCost(2, Number.MAX_SAFE_INTEGER));
  assert.throws(() => record({ quantity: Number.MAX_SAFE_INTEGER }));
  assert.throws(() => acquisitionCost(-1, 100));
  assert.throws(() => acquisitionCost(2, 1.5));
});

test('all editable fields can change while identity and creation time stay protected', () => {
  const original = Object.freeze(record());
  const changed = buildEditedRecord(original, {
    quantity: 3, notes: 'Reorder soon', name: 'Tampered', location: 'Elsewhere',
    costPerUnitMinor: 0, measurementPerUnit: 'tampered', created_at: later, quantityAlertThreshold: 0, id: 'different', inventoryDate: '2020-01-01',
  }, later);
  assert.deepEqual(changed, {
    ...original, name: 'Tampered', location: 'Elsewhere', quantity: 3, notes: 'Reorder soon',
    costPerUnitMinor: 0, measurementPerUnit: 'tampered', quantityAlertThreshold: 0, lastUpdatedAt: later, inventoryDate: '2020-01-01',
  });
  assert.equal(changed.id, original.id);
  assert.equal(changed.inventoryDate, '2020-01-01');
  assert.equal(changed.created_at, original.created_at);
  assert.equal(original.quantity, 20);
});

test('unchanged edits preserve the timestamp and record identity', () => {
  const original = record();
  assert.equal(buildEditedRecord(original, { quantity: original.quantity, notes: original.notes }, later), original);
});

test('invalid edits cannot change inventory', () => {
  const original = record();
  assert.throws(() => buildEditedRecord(original, { quantity: -1, notes: '' }, later));
  assert.throws(() => buildEditedRecord(original, { quantity: 1.2, notes: '' }, later));
  assert.throws(() => buildEditedRecord(original, { quantity: 1, notes: null }, later));
  assert.throws(() => buildEditedRecord(original, { quantity: 2, notes: '' }, 'invalid'));
  assert.equal(original.quantity, 20);
});

test('low stock includes equality and zero and clears above threshold', () => {
  assert.equal(summarizeStock(record({ quantity: 5 })).isLowStock, true);
  assert.equal(summarizeStock(record({ quantity: 0 })).isLowStock, true);
  assert.equal(summarizeStock(record({ quantity: 0, quantityAlertThreshold: 0 })).isLowStock, true);
  assert.equal(summarizeStock(record({ quantity: 6 })).isLowStock, false);
});

test('form errors identify required, numeric, date, and overflow problems', () => {
  const result = validateStockForm({ ...form, name: ' ', location: '', quantity: '-1', costPerUnit: '1.234', quantityAlertThreshold: '0.5', inventoryDate: '2026-02-30' });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['name', 'location', 'quantity', 'costPerUnit', 'quantityAlertThreshold', 'inventoryDate'].sort());
  const overflow = validateStockForm({ ...form, quantity: String(Number.MAX_SAFE_INTEGER) });
  assert.equal(overflow.ok, false);
  assert.match(overflow.errors.quantity, /too large/);
});

test('valid forms support optional notes and zero values', () => {
  const result = validateStockForm({ ...form, quantity: '0', costPerUnit: '0', quantityAlertThreshold: '0' });
  assert.equal(result.ok, true);
  assert.equal(result.input.quantity, 0);
  assert.equal(result.input.costPerUnitMinor, 0);
  assert.equal(result.input.notes, '');
});

test('dates validate leap years and reject normalization of impossible dates', () => {
  for (const value of ['2024-02-29', '2000-02-29', '2026-10-22']) assert.equal(isInventoryDate(value), true, value);
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-01']) assert.equal(isInventoryDate(value), false, value);
  assert.equal(localToday(new Date(2026, 9, 22, 0, 1)), '2026-10-22');
  const displayed = formatInventoryDate('2026-10-22');
  assert.match(displayed, /22/);
  assert.match(displayed, /2026/);
});

const records = Object.freeze([
  record({ name: 'Rice large', quantity: 10, location: 'shelf B', inventoryDate: '2026-10-20' }, 'a'),
  record({ name: 'Rice small', quantity: 5, location: 'Shelf A', inventoryDate: '2026-10-21' }, 'b'),
  record({ name: 'Soap', quantity: 0, location: 'Shelf C', inventoryDate: '2026-10-22' }, 'c'),
  record({ name: 'Rice medium', quantity: 2, location: 'shelf D', inventoryDate: '2026-10-19' }, 'd'),
]);

test('search is partial and case insensitive, and combines with low-stock filtering and sorting', () => {
  const result = selectStocks(records, { search: ' RICE ', lowStockOnly: true, sortBy: 'quantity', direction: 'asc' });
  assert.deepEqual(result.map((item) => item.id), ['d', 'b']);
  assert.deepEqual(records.map((item) => item.id), ['a', 'b', 'c', 'd']);
});

test('all supported sort fields work in both directions', () => {
  const expectations = [
    ['inventoryDate', 'asc', ['d', 'a', 'b', 'c']],
    ['inventoryDate', 'desc', ['c', 'b', 'a', 'd']],
    ['quantity', 'asc', ['c', 'd', 'b', 'a']],
    ['quantity', 'desc', ['a', 'b', 'd', 'c']],
    ['location', 'asc', ['b', 'a', 'c', 'd']],
    ['location', 'desc', ['d', 'c', 'a', 'b']],
  ];
  for (const [sortBy, direction, ids] of expectations) {
    assert.deepEqual(selectStocks(records, { ...DEFAULT_LIST_OPTIONS, sortBy, direction }).map((item) => item.id), ids);
  }
});

test('searches and filters can have no results without changing the source', () => {
  assert.equal(selectStocks(records, { ...DEFAULT_LIST_OPTIONS, search: 'missing' }).length, 0);
  assert.equal(selectStocks([], DEFAULT_LIST_OPTIONS).length, 0);
  assert.equal(selectStocks([record()], { ...DEFAULT_LIST_OPTIONS, lowStockOnly: true }).length, 0);
});

test('snapshot loading rejects malformed, unsupported, and duplicate records', () => {
  const stock = record();
  for (const json of ['', 'null', '{}', '{', JSON.stringify({ version: 4, stocks: [] }), JSON.stringify({ version: 1, stocks: [stock, stock] })]) {
    assert.throws(() => parseSnapshot(json));
  }
  for (const overrides of [{ quantity: -1 }, { costPerUnitMinor: 0.1 }, { quantityAlertThreshold: null }, { inventoryDate: '2026-02-30' }, { lastUpdatedAt: '2026-02-30T10:00:00.000Z' }, { notes: null }, { id: '' }]) {
    assert.throws(() => parseSnapshot(JSON.stringify({ version: 1, stocks: [{ ...stock, ...overrides }] })));
  }
});

test('snapshot loading ignores persisted derived totals and rebuilds from source fields', () => {
  const stock = record();
  const snapshot = parseSnapshot(JSON.stringify({ version: 1, stocks: [{ ...stock, totalAcquisitionCostMinor: 1, isLowStock: true }] }));
  assert.deepEqual(snapshot.stocks, [stock]);
  assert.equal(summarizeStock(snapshot.stocks[0]).totalAcquisitionCostMinor, 30000);
});

test('optional cost and measurement preserve unknown values instead of zero', () => {
  const result = validateStockForm({ ...form, costPerUnit: ' ', measurementPerUnit: ' ' });
  assert.equal(result.ok, true);
  assert.equal(result.input.costPerUnitMinor, null);
  assert.equal(result.input.measurementPerUnit, null);
  const stock = createStock(result.input, 'optional', timestamp);
  assert.equal(stock.costPerUnitMinor, null);
  assert.equal(stock.measurementPerUnit, null);
  assert.equal(summarizeStock(stock).totalAcquisitionCostMinor, null);
  assert.equal(formatMoney(null), 'Not provided');
  assert.equal(summarizeStock(buildEditedRecord(stock, { quantity: 4, notes: '' }, later)).totalAcquisitionCostMinor, null);
  const explicitZero = validateStockForm({ ...form, costPerUnit: '0', measurementPerUnit: ' 500 g ' });
  assert.equal(explicitZero.ok, true);
  assert.equal(explicitZero.input.costPerUnitMinor, 0);
  assert.equal(explicitZero.input.measurementPerUnit, '500 g');
  assert.equal(acquisitionCost(20, 0), 0);
  assert.equal(validateStockForm({ ...form, costPerUnit: '-1' }).ok, false);
});

test('creation inputs may omit both optional fields', () => {
  const withoutCost = { ...input };
  delete withoutCost.costPerUnitMinor;
  const stock = createStock(withoutCost, 'no-cost', timestamp);
  assert.equal(stock.costPerUnitMinor, null);
  assert.equal(stock.measurementPerUnit, null);
  assert.equal(stock.created_at, timestamp);
});

test('default ordering follows creation time regardless of received dates or later edits', () => {
  const first = createStock({ ...input, inventoryDate: '2026-10-22' }, 'first', timestamp);
  const second = createStock({ ...input, inventoryDate: '2020-01-01' }, 'second', later);
  const editedFirst = buildEditedRecord(first, { quantity: 1, notes: 'Edited after second stock' }, '2026-10-23T10:00:00.000Z');
  assert.equal(DEFAULT_LIST_OPTIONS.sortBy, 'created_at');
  assert.deepEqual(selectStocks([editedFirst, second], DEFAULT_LIST_OPTIONS).map((stock) => stock.id), ['second', 'first']);
  assert.deepEqual(selectStocks([editedFirst, second], { ...DEFAULT_LIST_OPTIONS, direction: 'asc' }).map((stock) => stock.id), ['first', 'second']);
  assert.equal(editedFirst.created_at, timestamp);
});

test('equal creation timestamps put the later appended record first', () => {
  const first = record({}, 'first');
  const second = record({}, 'second');
  assert.deepEqual(selectStocks([first, second], DEFAULT_LIST_OPTIONS).map((stock) => stock.id), ['second', 'first']);
});

test('locations are trimmed, case-insensitively deduplicated, and sorted', () => {
  assert.deepEqual(normalizeLocations([' Shelf B ', 'Shelf A', 'shelf b']), ['Shelf A', 'Shelf B']);
  assert.throws(() => normalizeLocations([' ']));
  const snapshot = { version: 3, stocks: [], locations: ['Shelf A'], quantityHistory: [] };
  const duplicate = addLocationToSnapshot(snapshot, ' shelf a ');
  assert.equal(duplicate.snapshot, snapshot);
  assert.equal(duplicate.location, 'Shelf A');
  const added = addLocationToSnapshot(snapshot, ' Shelf B ');
  assert.deepEqual(added.snapshot.locations, ['Shelf A', 'Shelf B']);
  assert.deepEqual(snapshot.locations, ['Shelf A']);
  assert.throws(() => addLocationToSnapshot(snapshot, ' '));
});

test('legacy snapshots preserve stock and derive locations and a documented creation fallback', () => {
  const original = record();
  const legacyRecord = { ...original };
  delete legacyRecord.created_at;
  delete legacyRecord.measurementPerUnit;
  const migrated = parseSnapshot(JSON.stringify({ version: 1, stocks: [{ ...legacyRecord, lastUpdatedAt: later }] }));
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.quantityHistory, []);
  assert.deepEqual(migrated.locations, ['Shelf B']);
  assert.equal(migrated.stocks[0].created_at, later);
  assert.equal(migrated.stocks[0].measurementPerUnit, null);
  assert.equal(migrated.stocks[0].costPerUnitMinor, original.costPerUnitMinor);
  assert.equal(migrated.stocks[0].inventoryDate, original.inventoryDate);
});

test('v2 snapshots retain creation time, optional fields, and standalone locations', () => {
  const stock = buildEditedRecord(record({ costPerUnitMinor: null, measurementPerUnit: '1 L' }), { quantity: 1, notes: 'Opened' }, later);
  const snapshot = parseSnapshot(JSON.stringify({ version: 2, stocks: [stock], locations: ['Unused shelf'] }));
  assert.equal(snapshot.version, 3);
  assert.deepEqual(snapshot.quantityHistory, []);
  assert.deepEqual(snapshot.stocks, [stock]);
  assert.deepEqual(snapshot.locations, ['Shelf B', 'Unused shelf']);
  for (const overrides of [{ created_at: 'invalid' }, { created_at: undefined }, { measurementPerUnit: 123 }, { costPerUnitMinor: undefined }]) {
    assert.throws(() => parseSnapshot(JSON.stringify({ version: 2, stocks: [{ ...stock, ...overrides }], locations: [] })));
  }
  for (const locations of [null, [1], [' ']]) {
    assert.throws(() => parseSnapshot(JSON.stringify({ version: 2, stocks: [], locations })));
  }
});

const historySnapshot = () => ({ version: 3, stocks: [record()], locations: ['Shelf B'], quantityHistory: [], demoSeeded: true });

test('quantity changes create one immutable history entry alongside the new stock', () => {
  const original = historySnapshot();
  const { snapshot, result } = editStockInSnapshot(original, 'rice', {
    quantity: 12, notes: 'Updated notes', quantityChangeReason: 'Sold', quantityChangeExplanation: '  Eight units sold  ',
    name: 'Renamed rice', created_at: later,
  }, later);
  assert.equal(result.quantity, 12);
  assert.equal(result.name, 'Renamed rice');
  assert.equal(result.created_at, timestamp);
  assert.equal(result.lastUpdatedAt, later);
  assert.equal(snapshot.quantityHistory.length, 1);
  assert.deepEqual(snapshot.quantityHistory[0], {
    id: `rice:${later}:0`, stockId: 'rice', previousQuantity: 20, newQuantity: 12,
    reason: 'Sold', explanation: 'Eight units sold', timestamp: later,
  });
  assert.equal(snapshot.demoSeeded, true);
  assert.equal(addLocationToSnapshot(snapshot, 'Shelf C').snapshot.quantityHistory, snapshot.quantityHistory);
  assert.equal('quantityChangeReason' in result, false);
  assert.equal(original.stocks[0].quantity, 20);
  assert.deepEqual(original.quantityHistory, []);
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), snapshot);
});

test('notes-only and unchanged saves never create quantity history', () => {
  const original = historySnapshot();
  const notes = editStockInSnapshot(original, 'rice', { quantity: 20, notes: 'New note' }, later);
  assert.equal(notes.result.notes, 'New note');
  assert.equal(notes.result.lastUpdatedAt, later);
  assert.equal(notes.snapshot.quantityHistory, original.quantityHistory);
  const unchanged = editStockInSnapshot(notes.snapshot, 'rice', { quantity: 20, notes: 'New note' }, timestamp);
  assert.equal(unchanged.snapshot, notes.snapshot);
  assert.equal(unchanged.result.lastUpdatedAt, later);
});

test('quantity updates require a valid reason and cannot mutate on validation failure', () => {
  const original = historySnapshot();
  for (const reason of [undefined, '', 'Unknown']) {
    assert.throws(() => editStockInSnapshot(original, 'rice', { quantity: 12, notes: '', quantityChangeReason: reason }, later), /reason/);
  }
  assert.throws(() => editStockInSnapshot(original, 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Other', quantityChangeExplanation: null }, later), /text/);
  assert.throws(() => editStockInSnapshot(original, 'missing', { quantity: 12, notes: '' }, later), /found/);
  assert.equal(original.stocks[0].quantity, 20);
  assert.deepEqual(original.quantityHistory, []);
});

test('history supports zero, replenishment, unknown cost, and same-time updates', () => {
  const original = { ...historySnapshot(), stocks: [record({ costPerUnitMinor: null })] };
  const zero = editStockInSnapshot(original, 'rice', { quantity: 0, notes: '', quantityChangeReason: 'Count correction' }, later).snapshot;
  const replenished = editStockInSnapshot(zero, 'rice', { quantity: 10, notes: '', quantityChangeReason: 'Restocked' }, later).snapshot;
  assert.equal(new Set(replenished.quantityHistory.map((entry) => entry.id)).size, 2);
  assert.deepEqual(selectQuantityHistory(replenished.quantityHistory, 'rice').map((entry) => entry.newQuantity), [10, 0]);
  assert.deepEqual(parseSnapshot(JSON.stringify(replenished)), replenished);
  assert.equal(summarizeStock(replenished.stocks[0]).totalAcquisitionCostMinor, null);
});

test('history is isolated per stock and the selector does not reorder stored entries', () => {
  let current = { ...historySnapshot(), stocks: [record(), record({}, 'soap')] };
  current = editStockInSnapshot(current, 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Sold' }, later).snapshot;
  current = editStockInSnapshot(current, 'soap', { quantity: 19, notes: '', quantityChangeReason: 'Damaged' }, later).snapshot;
  current = editStockInSnapshot(current, 'rice', { quantity: 25, notes: '', quantityChangeReason: 'Restocked' }, timestamp).snapshot;
  const storedIds = current.quantityHistory.map((entry) => entry.id);
  assert.deepEqual(selectQuantityHistory(current.quantityHistory, 'rice').map((entry) => entry.newQuantity), [25, 12]);
  assert.equal(selectQuantityHistory(current.quantityHistory, 'soap').length, 1);
  assert.deepEqual(selectQuantityHistory(current.quantityHistory, 'missing'), []);
  assert.deepEqual(current.quantityHistory.map((entry) => entry.id), storedIds);
});

test('v3 validation rejects malformed, orphaned, duplicate, and inconsistent history', () => {
  const saved = editStockInSnapshot(historySnapshot(), 'rice', { quantity: 12, notes: '', quantityChangeReason: 'Sold' }, later).snapshot;
  const entry = saved.quantityHistory[0];
  for (const overrides of [
    { id: '' }, { stockId: 'missing' }, { previousQuantity: -1 }, { newQuantity: 1.2 },
    { previousQuantity: 12 }, { reason: 'Unknown' }, { explanation: null }, { timestamp: 'invalid' }, { newQuantity: 13 },
  ]) {
    assert.throws(() => parseSnapshot(JSON.stringify({ ...saved, quantityHistory: [{ ...entry, ...overrides }] })), /history/);
  }
  for (const quantityHistory of [null, undefined, [entry, entry], [entry, { ...entry, id: 'second', previousQuantity: 7 }]]) {
    assert.throws(() => parseSnapshot(JSON.stringify({ ...saved, quantityHistory })), /history/);
  }
});

test('metadata-only changes recalculate cost and alerts without adding quantity history', () => {
  const original = { ...historySnapshot(), locations: ['Shelf B', 'Shelf C'] };
  const changed = editStockInSnapshot(original, 'rice', {
    quantity: 20, notes: 'Moved', name: ' Rice premium ', location: ' shelf c ',
    costPerUnitMinor: 1800, measurementPerUnit: ' 2 kg ', quantityAlertThreshold: 25,
    inventoryDate: '2020-01-01', created_at: later, lastUpdatedAt: timestamp, id: 'injected',
  }, later);
  assert.equal(changed.result.name, 'Rice premium');
  assert.equal(changed.result.location, 'Shelf C');
  assert.equal(changed.result.measurementPerUnit, '2 kg');
  assert.equal(changed.result.notes, 'Moved');
  assert.equal(changed.result.lastUpdatedAt, later);
  assert.equal(changed.result.inventoryDate, '2020-01-01');
  assert.equal(changed.result.created_at, timestamp);
  assert.equal(changed.result.id, 'rice');
  assert.equal(summarizeStock(changed.result).totalAcquisitionCostMinor, 36000);
  assert.equal(summarizeStock(changed.result).isLowStock, true);
  assert.equal(changed.snapshot.quantityHistory, original.quantityHistory);
  assert.deepEqual(parseSnapshot(JSON.stringify(changed.snapshot)), changed.snapshot);
  assert.equal(original.stocks[0].name, 'Jasmine rice');
});

test('editing rejects unknown or blank locations without changing stock or history', () => {
  const original = historySnapshot();
  for (const location of ['Unknown shelf', '', ' ', null]) {
    assert.throws(() => editStockInSnapshot(original, 'rice', { quantity: 20, notes: '', location }, later), /location/);
  }
  assert.deepEqual(original.quantityHistory, []);
  assert.equal(original.stocks[0].location, 'Shelf B');
});

test('optional cost and measurement can be filled, cleared, and normalized to no-op edits', () => {
  const original = record({ costPerUnitMinor: null, measurementPerUnit: null });
  const filled = buildEditedRecord(original, { quantity: 20, notes: '', costPerUnitMinor: 1550, measurementPerUnit: ' 500 g ' }, later);
  assert.equal(filled.costPerUnitMinor, 1550);
  assert.equal(filled.measurementPerUnit, '500 g');
  const unchanged = buildEditedRecord(filled, { quantity: 20, notes: '', name: ' Jasmine rice ', location: ' Shelf B ', measurementPerUnit: ' 500 g ' }, timestamp);
  assert.equal(unchanged, filled);
  const cleared = buildEditedRecord(filled, { quantity: 20, notes: '', costPerUnitMinor: null, measurementPerUnit: ' ' }, later);
  assert.equal(cleared.costPerUnitMinor, null);
  assert.equal(cleared.measurementPerUnit, null);
  assert.equal(summarizeStock(cleared).totalAcquisitionCostMinor, null);
});

test('editable field validation rejects invalid counts, text, costs, and overflow', () => {
  const original = record();
  for (const fields of [
    { name: '' }, { name: null }, { location: ' ' }, { quantityAlertThreshold: -1 },
    { quantityAlertThreshold: 1.5 }, { costPerUnitMinor: -1 }, { costPerUnitMinor: 0.5 },
    { measurementPerUnit: 123 }, { costPerUnitMinor: Number.MAX_SAFE_INTEGER },
    { inventoryDate: '' }, { inventoryDate: null }, { inventoryDate: '2026-02-30' },
  ]) {
    assert.throws(() => buildEditedRecord(original, { quantity: 20, notes: '', ...fields }, later));
  }
  assert.equal(original.quantity, 20);
  assert.equal(original.costPerUnitMinor, 1500);
});

test('editing details and quantity together saves one coherent history entry', () => {
  const original = { ...historySnapshot(), locations: ['Shelf B', 'Shelf C'] };
  const changed = editStockInSnapshot(original, 'rice', {
    name: 'Premium rice', location: 'Shelf C', quantity: 12, costPerUnitMinor: 2000,
    measurementPerUnit: '1 kg', quantityAlertThreshold: 15, notes: 'Recounted after moving',
    quantityChangeReason: 'Count correction',
  }, later);
  assert.equal(changed.snapshot.quantityHistory.length, 1);
  assert.equal(changed.snapshot.quantityHistory[0].previousQuantity, 20);
  assert.equal(changed.snapshot.quantityHistory[0].newQuantity, 12);
  assert.equal(changed.result.name, 'Premium rice');
  assert.equal(changed.result.location, 'Shelf C');
  assert.equal(summarizeStock(changed.result).totalAcquisitionCostMinor, 24000);
  assert.deepEqual(parseSnapshot(JSON.stringify(changed.snapshot)), changed.snapshot);
});

test('received-date-only edits save without quantity history or changing creation order', () => {
  const original = { ...historySnapshot(), stocks: [record(), record({ inventoryDate: '2026-10-21' }, 'other')] };
  const changed = editStockInSnapshot(original, 'rice', { quantity: 20, notes: '', inventoryDate: '2026-10-23' }, later);
  assert.notEqual(changed.snapshot, original);
  assert.equal(changed.result.inventoryDate, '2026-10-23');
  assert.equal(changed.result.created_at, timestamp);
  assert.equal(changed.result.lastUpdatedAt, later);
  assert.equal(changed.snapshot.quantityHistory, original.quantityHistory);
  assert.equal(original.stocks[0].inventoryDate, '2026-10-22');
  assert.deepEqual(selectStocks(changed.snapshot.stocks, { ...DEFAULT_LIST_OPTIONS, sortBy: 'inventoryDate' }).map((stock) => stock.id), ['rice', 'other']);
  assert.deepEqual(selectStocks(changed.snapshot.stocks, DEFAULT_LIST_OPTIONS).map((stock) => stock.id), ['other', 'rice']);
  assert.equal(buildEditedRecord(changed.result, { quantity: 20, notes: '', inventoryDate: '2026-10-23' }, timestamp), changed.result);
});

test('legacy location casing still selects the deduplicated dropdown option', () => {
  const first = record({ location: 'Shelf A' }, 'first');
  const second = record({ location: 'shelf a' }, 'second');
  const migrated = parseSnapshot(JSON.stringify({ version: 1, stocks: [first, second] }));
  assert.deepEqual(migrated.locations, ['Shelf A']);
  assert.equal(isSameLocation(migrated.stocks[1].location, migrated.locations[0]), true);
  assert.equal(isSameLocation(' Shelf A ', 'shelf a'), true);
  assert.equal(isSameLocation('Shelf A', 'Shelf B'), false);
  assert.equal(isSameLocation('', 'Shelf A'), false);
});

test('submission reports a missing quantity reason together with other invalid fields', () => {
  const result = validateStockSubmission({ ...form, quantity: '12', name: ' ', costPerUnit: '-1' }, 20, null);
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['costPerUnit', 'name']);
  assert.match(result.message, /Stock name/);
  assert.match(result.message, /Cost per unit/);
  assert.match(result.message, /Reason \(required when quantity changes\)/);
  assert.match(result.reasonError, /Choose a reason/);
});

test('a missing reason alone blocks saving and remains available to bottom feedback', () => {
  const result = validateStockSubmission({ ...form, quantity: '0' }, 20, null);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, {});
  assert.match(result.message, /Reason/);
  assert.equal(validateStockSubmission({ ...form, quantity: '0' }, 20, 'Count correction').ok, true);
});

test('create and metadata-only submissions do not require a quantity reason', () => {
  assert.equal(validateStockSubmission(form, undefined, null).ok, true);
  const result = validateStockSubmission({ ...form, inventoryDate: '2026-10-23', notes: 'Corrected' }, 20, null);
  assert.equal(result.ok, true);
  assert.equal(result.input.inventoryDate, '2026-10-23');
  assert.equal(result.input.notes, 'Corrected');
});

test('invalid quantities produce field feedback before requiring a reason', () => {
  const result = validateStockSubmission({ ...form, quantity: '' }, 20, null);
  assert.equal(result.ok, false);
  assert.match(result.message, /Quantity/);
  assert.equal(result.reasonError, null);
});
