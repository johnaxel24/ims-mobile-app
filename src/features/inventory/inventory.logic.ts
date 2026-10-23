import type {
  CreateStockInput,
  EditStockInput,
  InventoryListOptions,
  InventorySnapshot,
  QuantityChangeReason,
  QuantityHistoryEntry,
  StockFormErrors,
  StockFormResult,
  StockFormValues,
  StockRecord,
  StockSummary,
} from './inventory.types';

export const DEFAULT_LIST_OPTIONS: InventoryListOptions = {
  search: '', lowStockOnly: false, sortBy: 'created_at', direction: 'desc',
};

export const QUANTITY_CHANGE_REASONS: readonly QuantityChangeReason[] = [
  'Restocked', 'Sold', 'Damaged', 'Count correction', 'Other',
];

/** Builds one snapshot so the quantity and its explanation can never save separately. */
export function editStockInSnapshot(snapshot: InventorySnapshot, stockId: string, input: EditStockInput, timestamp: string): { snapshot: InventorySnapshot; result: StockRecord } {
  const original = snapshot.stocks.find((stock) => stock.id === stockId);
  if (!original) throw new Error('This stock record could not be found.');
  let editInput = input;
  if (input.location !== undefined) {
    if (typeof input.location !== 'string') throw new Error('Select a saved location or add a new one first.');
    const requestedLocation = input.location.trim().toLocaleLowerCase();
    const location = snapshot.locations.find((name) => name.toLocaleLowerCase() === requestedLocation);
    if (!location) throw new Error('Select a saved location or add a new one first.');
    editInput = { ...input, location };
  }
  const record = buildEditedRecord(original, editInput, timestamp);
  if (record === original) return { snapshot, result: record };
  let quantityHistory = snapshot.quantityHistory;
  if (record.quantity !== original.quantity) {
    if (!input.quantityChangeReason || !QUANTITY_CHANGE_REASONS.includes(input.quantityChangeReason)) {
      throw new Error('Choose a reason for the quantity change.');
    }
    if (input.quantityChangeExplanation !== undefined && typeof input.quantityChangeExplanation !== 'string') {
      throw new Error('The quantity explanation must be text.');
    }
    let suffix = quantityHistory.length;
    let id = `${stockId}:${timestamp}:${suffix}`;
    while (quantityHistory.some((entry) => entry.id === id)) id = `${stockId}:${timestamp}:${++suffix}`;
    quantityHistory = [...quantityHistory, {
      id, stockId, previousQuantity: original.quantity, newQuantity: record.quantity,
      reason: input.quantityChangeReason, explanation: input.quantityChangeExplanation?.trim() ?? '', timestamp,
    }];
  }
  return {
    snapshot: { ...snapshot, stocks: snapshot.stocks.map((stock) => stock.id === stockId ? record : stock), quantityHistory },
    result: record,
  };
}

/** Append order also handles multiple saves at the same timestamp or device clock changes. */
export function selectQuantityHistory(entries: readonly QuantityHistoryEntry[], stockId: string): QuantityHistoryEntry[] {
  return entries.filter((entry) => entry.stockId === stockId).reverse();
}

export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isInventoryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function formatInventoryDate(value: string): string {
  if (!isInventoryDate(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Integer arithmetic keeps all displayed decimals exact, even at large amounts. */
export function formatMoney(minor: number | null): string {
  if (minor === null) return 'Not provided';
  const whole = Math.floor(minor / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${whole}.${String(minor % 100).padStart(2, '0')}`;
}

export function moneyInput(minor: number | null): string {
  if (minor === null) return '';
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseMoney(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function acquisitionCost(quantity: number, costPerUnitMinor: number | null): number | null {
  if (!isCount(quantity)) throw new Error('Quantity must be a nonnegative whole number.');
  if (costPerUnitMinor === null) return null;
  const total = quantity * costPerUnitMinor;
  if (!isCount(quantity) || !isCount(costPerUnitMinor) || !Number.isSafeInteger(total)) {
    throw new Error('Quantity and cost must produce a valid, safely representable total.');
  }
  return total;
}

function assertInput(input: CreateStockInput): void {
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('Enter a stock name.');
  if (typeof input.location !== 'string' || !input.location.trim()) throw new Error('Enter a location.');
  if (!isCount(input.quantity)) throw new Error('Quantity must be a nonnegative whole number.');
  if (!isCount(input.quantityAlertThreshold)) throw new Error('Alert threshold must be a nonnegative whole number.');
  if (typeof input.notes !== 'string') throw new Error('Notes must be text.');
  if (input.measurementPerUnit != null && typeof input.measurementPerUnit !== 'string') {
    throw new Error('Measurement per unit must be text.');
  }
  if (typeof input.inventoryDate !== 'string' || !isInventoryDate(input.inventoryDate)) {
    throw new Error('Enter a valid inventory date.');
  }
  acquisitionCost(input.quantity, input.costPerUnitMinor ?? null);
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function createStock(input: CreateStockInput, id: string, timestamp: string): StockRecord {
  assertInput(input);
  if (!id.trim() || !isTimestamp(timestamp)) throw new Error('Could not create a valid stock record.');
  // Explicit fields also prevent callers from injecting calculated values or metadata.
  return {
    id, name: input.name.trim(), quantity: input.quantity, location: input.location.trim(),
    costPerUnitMinor: input.costPerUnitMinor ?? null,
    measurementPerUnit: input.measurementPerUnit?.trim() || null,
    quantityAlertThreshold: input.quantityAlertThreshold,
    notes: input.notes, inventoryDate: input.inventoryDate, lastUpdatedAt: timestamp, created_at: timestamp,
  };
}

/** Record builder only. Application edits must use editStockInSnapshot for history policy. */
export function buildEditedRecord(record: StockRecord, input: EditStockInput, timestamp: string): StockRecord {
  // Explicit fields protect identity and creation time, even from untyped caller input.
  const updated = createStock({
    name: input.name === undefined ? record.name : input.name,
    location: input.location === undefined ? record.location : input.location,
    costPerUnitMinor: input.costPerUnitMinor === undefined ? record.costPerUnitMinor : input.costPerUnitMinor,
    measurementPerUnit: input.measurementPerUnit === undefined ? record.measurementPerUnit : input.measurementPerUnit,
    quantityAlertThreshold: input.quantityAlertThreshold === undefined ? record.quantityAlertThreshold : input.quantityAlertThreshold,
    quantity: input.quantity, notes: input.notes,
    inventoryDate: input.inventoryDate === undefined ? record.inventoryDate : input.inventoryDate,
  }, record.id, record.created_at);
  if (!isTimestamp(timestamp)) throw new Error('Could not update the timestamp.');
  if (record.name === updated.name && record.location === updated.location
    && record.costPerUnitMinor === updated.costPerUnitMinor && record.measurementPerUnit === updated.measurementPerUnit
    && record.quantityAlertThreshold === updated.quantityAlertThreshold
    && record.quantity === updated.quantity && record.notes === updated.notes
    && record.inventoryDate === updated.inventoryDate) return record;
  return { ...updated, lastUpdatedAt: timestamp };
}

export function summarizeStock(stock: StockRecord): StockSummary {
  return {
    ...stock,
    totalAcquisitionCostMinor: acquisitionCost(stock.quantity, stock.costPerUnitMinor),
    isLowStock: stock.quantity <= stock.quantityAlertThreshold,
  };
}

export function selectStocks(records: readonly StockRecord[], options: InventoryListOptions): StockSummary[] {
  const query = options.search.trim().toLocaleLowerCase();
  const direction = options.direction === 'asc' ? 1 : -1;
  return records.map((record, index) => ({ stock: summarizeStock(record), index }))
    .filter(({ stock }) => stock.name.toLocaleLowerCase().includes(query) && (!options.lowStockOnly || stock.isLowStock))
    .sort((a, b) => {
      let comparison: number;
      if (options.sortBy === 'created_at') {
        comparison = a.stock.created_at.localeCompare(b.stock.created_at);
        // Records are appended on creation, so later insertions win timestamp ties.
        return (comparison || a.index - b.index) * direction;
      }
      if (options.sortBy === 'quantity') comparison = a.stock.quantity - b.stock.quantity;
      else if (options.sortBy === 'location') comparison = a.stock.location.localeCompare(b.stock.location, undefined, { sensitivity: 'base' });
      else comparison = a.stock.inventoryDate.localeCompare(b.stock.inventoryDate);
      return comparison * direction || a.stock.name.localeCompare(b.stock.name) || a.stock.id.localeCompare(b.stock.id);
    }).map(({ stock }) => stock);
}

export function emptyStockForm(): StockFormValues {
  return { name: '', quantity: '', location: '', costPerUnit: '', measurementPerUnit: '', quantityAlertThreshold: '', notes: '', inventoryDate: localToday() };
}

export function stockFormValues(stock: StockRecord): StockFormValues {
  return {
    name: stock.name, quantity: String(stock.quantity), location: stock.location,
    costPerUnit: moneyInput(stock.costPerUnitMinor), quantityAlertThreshold: String(stock.quantityAlertThreshold),
    measurementPerUnit: stock.measurementPerUnit ?? '',
    notes: stock.notes, inventoryDate: stock.inventoryDate,
  };
}

export function validateStockForm(values: StockFormValues): StockFormResult {
  const errors: StockFormErrors = {};
  const quantity = parseWholeNumber(values.quantity);
  const cost = parseMoney(values.costPerUnit);
  const threshold = parseWholeNumber(values.quantityAlertThreshold);
  if (!values.name.trim()) errors.name = 'Enter a stock name.';
  if (!values.location.trim()) errors.location = 'Enter a location, such as Shelf A.';
  if (quantity === null) errors.quantity = 'Enter a nonnegative whole number.';
  if (values.costPerUnit.trim() && cost === null) errors.costPerUnit = 'Enter a nonnegative amount with up to 2 decimals, or leave blank.';
  if (threshold === null) errors.quantityAlertThreshold = 'Enter a nonnegative whole number.';
  if (!isInventoryDate(values.inventoryDate)) errors.inventoryDate = 'Use a valid date in YYYY-MM-DD format.';
  if (quantity !== null && cost !== null && !Number.isSafeInteger(quantity * cost)) {
    errors.quantity = 'This quantity makes the total too large. Enter a smaller value.';
  }
  if (Object.keys(errors).length || quantity === null || threshold === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      name: values.name.trim(), quantity, location: values.location.trim(), costPerUnitMinor: cost,
      measurementPerUnit: values.measurementPerUnit.trim() || null,
      quantityAlertThreshold: threshold, notes: values.notes, inventoryDate: values.inventoryDate,
    },
  };
}

export function isSameLocation(first: string, second: string): boolean {
  return first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase();
}

export function normalizeLocations(locations: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const location of locations) {
    const trimmed = location.trim();
    if (!trimmed) throw new Error('Enter a location name.');
    const key = trimmed.toLocaleLowerCase();
    if (!unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function addLocationToSnapshot(snapshot: InventorySnapshot, name: string): { snapshot: InventorySnapshot; location: string } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a location name.');
  const existing = snapshot.locations.find((location) => location.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  if (existing) return { snapshot, location: existing };
  return { snapshot: { ...snapshot, locations: normalizeLocations([...snapshot.locations, trimmed]) }, location: trimmed };
}

