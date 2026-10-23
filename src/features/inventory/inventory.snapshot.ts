import {
  acquisitionCost, createStock, isCount, isInventoryDate, isTimestamp, normalizeLocations,
  productKey, QUANTITY_CHANGE_REASONS, quantityReasonError, validateReceiptQuantity,
} from './inventory.logic';
import type { DeliveryReceipt, InventorySnapshot, QuantityChangeReason, QuantityHistoryEntry, StockRecord } from './inventory.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(part = 'inventory'): Error {
  return new Error(`Saved ${part} is invalid. Your stored data has not been changed.`);
}

interface LegacyStock extends StockRecord {
  readonly quantityReceived: number | null;
  readonly costPerUnitMinor: number | null;
}

/** Preserve older unit variants; never add together incompatible measurements. */
function storedProductKey(stock: StockRecord): string {
  return JSON.stringify([productKey(stock), stock.measurementPerUnit?.trim().toLocaleLowerCase() ?? '']);
}

function parseRecord(value: unknown, version: number): StockRecord {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.location !== 'string' || !value.location.trim()
    || !isCount(value.quantity) || !isCount(value.quantityAlertThreshold)
    || typeof value.notes !== 'string' || typeof value.inventoryDate !== 'string'
    || !isInventoryDate(value.inventoryDate) || !isTimestamp(value.lastUpdatedAt)
    || (version !== 1 && (!isTimestamp(value.created_at)
      || !(value.measurementPerUnit === null || typeof value.measurementPerUnit === 'string')))) throw invalid('inventory record');
  const stock = createStock({
    name: value.name, quantity: value.quantity, location: value.location,
    quantityAlertThreshold: value.quantityAlertThreshold, notes: value.notes, inventoryDate: value.inventoryDate,
    measurementPerUnit: version === 1 ? null : value.measurementPerUnit as string | null,
  }, value.id, version === 1 ? value.lastUpdatedAt : value.created_at as string);
  return { ...stock, lastUpdatedAt: value.lastUpdatedAt };
}

function parseLegacyRecord(value: unknown, version: number): LegacyStock {
  const stock = parseRecord(value, version);
  if (!isObject(value) || !(isCount(value.costPerUnitMinor) || (version !== 1 && value.costPerUnitMinor === null))) throw invalid('inventory cost');
  const costPerUnitMinor = value.costPerUnitMinor as number | null;
  const quantityReceived = version === 4 ? value.quantityReceived : null;
  if (quantityReceived !== null && !isCount(quantityReceived)) throw invalid('received quantity');
  acquisitionCost(stock.quantity, costPerUnitMinor);
  validateReceiptQuantity(quantityReceived, stock.quantity, costPerUnitMinor);
  return { ...stock, quantityReceived, costPerUnitMinor };
}

function parseLegacyHistory(value: unknown, stocks: readonly LegacyStock[]): QuantityHistoryEntry[] {
  if (!Array.isArray(value)) throw invalid('quantity history');
  const ids = new Set<string>();
  const latest = new Map<string, number>();
  const byId = new Map(stocks.map((stock) => [stock.id, stock]));
  const history = value.map((entry: unknown): QuantityHistoryEntry => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)
      || typeof entry.stockId !== 'string' || !byId.has(entry.stockId)
      || !isCount(entry.previousQuantity) || !isCount(entry.newQuantity) || entry.previousQuantity === entry.newQuantity
      || typeof entry.reason !== 'string' || !QUANTITY_CHANGE_REASONS.includes(entry.reason as QuantityChangeReason)
      || typeof entry.explanation !== 'string' || !isTimestamp(entry.timestamp)) throw invalid('quantity history');
    if (latest.has(entry.stockId) && latest.get(entry.stockId) !== entry.previousQuantity) throw invalid('quantity history chain');
    ids.add(entry.id);
    latest.set(entry.stockId, entry.newQuantity);
    return { id: entry.id, stockId: entry.stockId, previousQuantity: entry.previousQuantity, newQuantity: entry.newQuantity,
      reason: entry.reason as QuantityChangeReason, explanation: entry.explanation.trim(), timestamp: entry.timestamp,
      kind: 'legacy-adjustment', receipt: null, sourceStockId: entry.stockId };
  });
  for (const [id, quantity] of latest) if (byId.get(id)?.quantity !== quantity) throw invalid('quantity history balance');
  return history;
}

/** Merge matching products while retaining original receipts and delivery-level movements. */
function migrate(stocks: readonly LegacyStock[], history: readonly QuantityHistoryEntry[]): Pick<InventorySnapshot, 'stocks' | 'quantityHistory'> {
  const groups = new Map<string, StockRecord>();
  const productIds = new Map<string, string>();
  for (const source of stocks) {
    const stock = parseRecord(source, 5);
    const key = storedProductKey(stock);
    const current = groups.get(key);
    productIds.set(stock.id, current?.id ?? stock.id);
    if (!current) { groups.set(key, stock); continue; }
    const quantity = current.quantity + stock.quantity;
    if (!isCount(quantity)) throw invalid('combined stock quantity');
    const newest = stock.lastUpdatedAt >= current.lastUpdatedAt ? stock : current;
    groups.set(key, { ...newest, id: current.id, quantity,
      quantityAlertThreshold: Math.max(current.quantityAlertThreshold, stock.quantityAlertThreshold),
      inventoryDate: current.inventoryDate > stock.inventoryDate ? current.inventoryDate : stock.inventoryDate,
      created_at: current.created_at < stock.created_at ? current.created_at : stock.created_at });
  }
  const ids = new Set(history.map((entry) => entry.id));
  const receipts = stocks.map((stock): QuantityHistoryEntry => {
    let id = `imported-receipt:${stock.id}`;
    while (ids.has(id)) id += ':receipt';
    ids.add(id);
    return { id, stockId: productIds.get(stock.id)!, kind: 'legacy-receipt', sourceStockId: stock.id,
      previousQuantity: null, newQuantity: null, reason: 'Restocked', explanation: stock.notes, timestamp: stock.created_at,
      receipt: { quantityReceived: stock.quantityReceived, costPerUnitMinor: stock.costPerUnitMinor,
        receivedDate: stock.inventoryDate, location: stock.location, remainingAtImport: stock.quantity } };
  });
  return { stocks: [...groups.values()], quantityHistory: [
    ...receipts, ...history.map((entry) => ({ ...entry, stockId: productIds.get(entry.stockId)! })),
  ] };
}

function parseReceipt(value: unknown, imported: boolean): DeliveryReceipt {
  if (!isObject(value) || !(isCount(value.quantityReceived) || (imported && value.quantityReceived === null))
    || !(isCount(value.costPerUnitMinor) || value.costPerUnitMinor === null)
    || !(value.totalAcquisitionCostMinor === undefined || value.totalAcquisitionCostMinor === null || isCount(value.totalAcquisitionCostMinor))
    || !(value.costUpdatedAt === undefined || isTimestamp(value.costUpdatedAt))
    || typeof value.receivedDate !== 'string' || !isInventoryDate(value.receivedDate)
    || typeof value.location !== 'string' || !value.location.trim()
    || (imported ? !isCount(value.remainingAtImport) : value.remainingAtImport !== null)) throw invalid('delivery receipt');
  const receipt: DeliveryReceipt = { quantityReceived: value.quantityReceived as number | null, costPerUnitMinor: value.costPerUnitMinor as number | null,
    ...(value.totalAcquisitionCostMinor === undefined ? {} : { totalAcquisitionCostMinor: value.totalAcquisitionCostMinor as number | null }),
    ...(value.costUpdatedAt === undefined ? {} : { costUpdatedAt: value.costUpdatedAt as string }),
    receivedDate: value.receivedDate, location: value.location.trim(), remainingAtImport: value.remainingAtImport as number | null };
  if (receipt.totalAcquisitionCostMinor === undefined) acquisitionCost(receipt.quantityReceived, receipt.costPerUnitMinor);
  if (imported) validateReceiptQuantity(receipt.quantityReceived, receipt.remainingAtImport!, null);
  return receipt;
}

function parseHistory(value: unknown, stocks: readonly StockRecord[]): QuantityHistoryEntry[] {
  if (!Array.isArray(value)) throw invalid('stock history');
  const stockIds = new Set(stocks.map((stock) => stock.id));
  const ids = new Set<string>();
  const imported = new Map<string, { stockId: string; quantity: number }>();
  const legacyLatest = new Map<string, number>();
  const latest = new Map<string, number>();
  const openingBalances = new Map<string, number>();
  const receivedDates = new Map<string, string>();
  const history = value.map((entry: unknown): QuantityHistoryEntry => {
    if (!isObject(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)
      || typeof entry.stockId !== 'string' || !stockIds.has(entry.stockId)
      || typeof entry.reason !== 'string' || !QUANTITY_CHANGE_REASONS.includes(entry.reason as QuantityChangeReason)
      || typeof entry.explanation !== 'string' || !isTimestamp(entry.timestamp)
      || typeof entry.kind !== 'string' || !['adjustment', 'delivery', 'legacy-adjustment', 'legacy-receipt'].includes(entry.kind)) throw invalid('stock history');
    ids.add(entry.id);
    const kind = entry.kind as QuantityHistoryEntry['kind'];
    const legacy = kind === 'legacy-adjustment' || kind === 'legacy-receipt';
    if (legacy ? typeof entry.sourceStockId !== 'string' || !entry.sourceStockId.trim() : entry.sourceStockId !== null) throw invalid('history source');
    const sourceStockId = entry.sourceStockId as string | null;
    const receipt = kind === 'delivery' || kind === 'legacy-receipt' ? parseReceipt(entry.receipt, legacy) : null;
    if (!receipt && entry.receipt !== null) throw invalid('history receipt');
    if (receipt) {
      const previousDate = receivedDates.get(entry.stockId);
      receivedDates.set(entry.stockId, previousDate && previousDate > receipt.receivedDate ? previousDate : receipt.receivedDate);
    }
    if (kind === 'legacy-receipt') {
      if (entry.previousQuantity !== null || entry.newQuantity !== null || entry.reason !== 'Restocked'
        || imported.has(sourceStockId!) || latest.has(entry.stockId)) throw invalid('imported receipt');
      imported.set(sourceStockId!, { stockId: entry.stockId, quantity: receipt!.remainingAtImport! });
      const opening = (openingBalances.get(entry.stockId) ?? 0) + receipt!.remainingAtImport!;
      if (!isCount(opening)) throw invalid('combined stock quantity');
      openingBalances.set(entry.stockId, opening);
    } else {
      if (!isCount(entry.previousQuantity) || !isCount(entry.newQuantity)) throw invalid('history quantities');
      if (kind === 'legacy-adjustment') {
        if (entry.previousQuantity === entry.newQuantity || imported.get(sourceStockId!)?.stockId !== entry.stockId
          || (legacyLatest.has(sourceStockId!) && legacyLatest.get(sourceStockId!) !== entry.previousQuantity)
          || latest.has(entry.stockId)) throw invalid('legacy history chain');
        legacyLatest.set(sourceStockId!, entry.newQuantity);
      } else {
        const opening = openingBalances.get(entry.stockId) ?? 0;
        if (entry.previousQuantity !== (latest.get(entry.stockId) ?? opening)) throw invalid('stock history chain');
        if (kind === 'delivery') {
          if (entry.reason !== 'Restocked' || entry.newQuantity !== entry.previousQuantity + receipt!.quantityReceived!
            || (receipt!.quantityReceived === 0 && (latest.has(entry.stockId) || openingBalances.has(entry.stockId)))) throw invalid('delivery balance');
        } else if (entry.previousQuantity === entry.newQuantity || quantityReasonError(entry.reason as QuantityChangeReason, entry.previousQuantity, entry.newQuantity)) throw invalid('adjustment reason');
        latest.set(entry.stockId, entry.newQuantity);
      }
    }
    return { id: entry.id, stockId: entry.stockId, previousQuantity: entry.previousQuantity as number | null,
      newQuantity: entry.newQuantity as number | null, reason: entry.reason as QuantityChangeReason,
      explanation: entry.explanation, timestamp: entry.timestamp, kind, receipt, sourceStockId };
  });
  for (const [source, quantity] of legacyLatest) if (imported.get(source)?.quantity !== quantity) throw invalid('legacy history balance');
  for (const stock of stocks) {
    const opening = openingBalances.get(stock.id) ?? 0;
    if (!isCount(opening) || (latest.get(stock.id) ?? opening) !== stock.quantity) throw invalid('stock history balance');
    if (receivedDates.get(stock.id) !== stock.inventoryDate) throw invalid('most recently received date');
  }
  return history;
}

/** Reads v1–v5 without writing. Old records merge by name, location, and measurement. */
export function parseSnapshot(json: string): InventorySnapshot {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('Saved inventory could not be read. Your stored data has not been changed.'); }
  if (!isObject(value) || typeof value.version !== 'number' || ![1, 2, 3, 4, 5].includes(value.version)
    || !Array.isArray(value.stocks)) throw invalid('inventory format');
  const version = value.version;
  const records = value.stocks.map((entry: unknown) => version === 5 ? parseRecord(entry, version) : parseLegacyRecord(entry, version));
  if (new Set(records.map((stock) => stock.id)).size !== records.length) throw invalid('duplicate stock IDs');
  if (version !== 1 && (!Array.isArray(value.locations) || !value.locations.every((location: unknown) => typeof location === 'string' && location.trim()))) throw invalid('locations');
  if (value.demoSeeded !== undefined && typeof value.demoSeeded !== 'boolean') throw invalid('legacy metadata');
  const locations = normalizeLocations([...(version === 1 ? [] : value.locations as string[]), ...records.map((stock) => stock.location)]);
  const data = version === 5
    ? { stocks: records, quantityHistory: parseHistory(value.quantityHistory, records) }
    : migrate(records as LegacyStock[], version >= 3 ? parseLegacyHistory(value.quantityHistory, records as LegacyStock[]) : []);
  // Old versions allowed different units at one location. Keep those records
  // readable; creation and identity edits enforce the stricter name/location rule.
  if (new Set(data.stocks.map(storedProductKey)).size !== data.stocks.length) throw invalid('duplicate products');
  return { version: 5, ...data, locations, ...(typeof value.demoSeeded === 'boolean' ? { demoSeeded: value.demoSeeded } : {}) };
}
