import { createStock, isCount, isInventoryDate, isTimestamp, normalizeLocations, QUANTITY_CHANGE_REASONS } from './inventory.logic';
import type { InventorySnapshot, QuantityChangeReason, QuantityHistoryEntry, StockRecord } from './inventory.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown, legacy: boolean): StockRecord {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.location !== 'string' || !value.location.trim()
    || !isCount(value.quantity)
    || !(isCount(value.costPerUnitMinor) || (!legacy && value.costPerUnitMinor === null))
    || !isCount(value.quantityAlertThreshold)
    || typeof value.notes !== 'string' || typeof value.inventoryDate !== 'string'
    || !isInventoryDate(value.inventoryDate) || !isTimestamp(value.lastUpdatedAt)
    || (!legacy && (!isTimestamp(value.created_at)
      || !(value.measurementPerUnit === null || typeof value.measurementPerUnit === 'string')))) {
    throw new Error('Saved inventory contains an invalid record. Your stored data has not been changed.');
  }
  const createdAt = legacy ? value.lastUpdatedAt : value.created_at as string;
  const record = createStock({
    name: value.name,
    location: value.location,
    quantity: value.quantity,
    costPerUnitMinor: value.costPerUnitMinor as number | null,
    quantityAlertThreshold: value.quantityAlertThreshold,
    measurementPerUnit: legacy ? null : value.measurementPerUnit as string | null,
    notes: value.notes,
    inventoryDate: value.inventoryDate,
  }, value.id, createdAt);
  return { ...record, lastUpdatedAt: value.lastUpdatedAt };
}

/** Validates untrusted JSON and migrates older envelopes without writing storage. */
export function parseSnapshot(json: string): InventorySnapshot {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error('Saved inventory could not be read. Your stored data has not been changed.');
  }
  if (!isObject(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3)
    || !Array.isArray(value.stocks)) {
    throw new Error('Saved inventory has an unsupported format. Your stored data has not been changed.');
  }
  const legacy = value.version === 1;
  const stocks = value.stocks.map((record: unknown) => parseRecord(record, legacy));
  if (new Set(stocks.map((stock) => stock.id)).size !== stocks.length) {
    throw new Error('Saved inventory contains duplicate IDs. Your stored data has not been changed.');
  }
  if (!legacy && (!Array.isArray(value.locations)
    || !value.locations.every((location: unknown) => typeof location === 'string' && location.trim()))) {
    throw new Error('Saved inventory contains invalid locations. Your stored data has not been changed.');
  }
  if (value.demoSeeded !== undefined && typeof value.demoSeeded !== 'boolean') {
    throw new Error('Saved inventory contains an invalid sample-data flag. Your stored data has not been changed.');
  }
  const locations = normalizeLocations([
    ...(legacy ? [] : value.locations as string[]),
    ...stocks.map((stock) => stock.location),
  ]);
  const quantityHistory = value.version === 3 ? parseQuantityHistory(value.quantityHistory, stocks) : [];
  return {
    version: 3,
    stocks,
    locations,
    quantityHistory,
    ...(typeof value.demoSeeded === 'boolean' ? { demoSeeded: value.demoSeeded } : {}),
  };
}

function parseQuantityHistory(value: unknown, stocks: readonly StockRecord[]): QuantityHistoryEntry[] {
  const invalid = () => new Error('Saved quantity history is invalid. Your stored data has not been changed.');
  if (!Array.isArray(value)) throw invalid();
  const stockById = new Map(stocks.map((stock) => [stock.id, stock]));
  const ids = new Set<string>();
  const latestQuantities = new Map<string, number>();
  const entries = value.map((entry: unknown): QuantityHistoryEntry => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)
      || typeof entry.stockId !== 'string' || !stockById.has(entry.stockId)
      || !isCount(entry.previousQuantity) || !isCount(entry.newQuantity)
      || entry.previousQuantity === entry.newQuantity
      || typeof entry.reason !== 'string' || !QUANTITY_CHANGE_REASONS.includes(entry.reason as QuantityChangeReason)
      || typeof entry.explanation !== 'string' || !isTimestamp(entry.timestamp)) throw invalid();
    const previous = latestQuantities.get(entry.stockId);
    if (previous !== undefined && previous !== entry.previousQuantity) throw invalid();
    ids.add(entry.id);
    latestQuantities.set(entry.stockId, entry.newQuantity);
    return {
      id: entry.id,
      stockId: entry.stockId,
      previousQuantity: entry.previousQuantity,
      newQuantity: entry.newQuantity,
      reason: entry.reason as QuantityChangeReason,
      explanation: entry.explanation.trim(),
      timestamp: entry.timestamp,
    };
  });
  for (const [id, quantity] of latestQuantities) {
    if (stockById.get(id)?.quantity !== quantity) throw invalid();
  }
  return entries;
}
