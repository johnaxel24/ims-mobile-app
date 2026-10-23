import type {
  CreateStockInput,
  DeliveryReceipt,
  EditDeliveryCostInput,
  EditStockInput,
  InventoryListOptions,
  InventorySnapshot,
  QuantityChangeReason,
  QuantityHistoryEntry,
  ReceiveStockInput,
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

/** Receiving has its own form so every new delivery captures its own date and cost. */
export const EDIT_QUANTITY_CHANGE_REASONS = QUANTITY_CHANGE_REASONS.filter((reason) => reason !== 'Restocked');

/** Remove the product and all associated receipts/movements in one snapshot. */
export function deleteStockInSnapshot(snapshot: InventorySnapshot, stockId: string): InventorySnapshot {
  if (!snapshot.stocks.some((stock) => stock.id === stockId)) throw new Error('This inventory item could not be found.');
  return {
    ...snapshot,
    stocks: snapshot.stocks.filter((stock) => stock.id !== stockId),
    quantityHistory: snapshot.quantityHistory.filter((entry) => entry.stockId !== stockId),
  };
}

export function productKey(stock: Pick<StockRecord, 'name' | 'location'>): string {
  return JSON.stringify([stock.name.trim().toLocaleLowerCase(), stock.location.trim().toLocaleLowerCase()]);
}

function assertUniqueProduct(stocks: readonly StockRecord[], stock: StockRecord, exceptId?: string): void {
  if (stocks.some((existing) => existing.id !== exceptId && productKey(existing) === productKey(stock))) {
    throw new Error(`A similar inventory item named “${stock.name}” already exists at “${stock.location}”. Open the existing item and select Receive stock.`);
  }
}

function historyId(snapshot: InventorySnapshot, stockId: string, timestamp: string): string {
  let suffix = snapshot.quantityHistory.length;
  let id = `${stockId}:${timestamp}:${suffix}`;
  while (snapshot.quantityHistory.some((entry) => entry.id === id)) id = `${stockId}:${timestamp}:${++suffix}`;
  return id;
}

function deliveryEntry(snapshot: InventorySnapshot, stock: StockRecord, previousQuantity: number, input: ReceiveStockInput, timestamp: string): QuantityHistoryEntry {
  if (!isTimestamp(timestamp) || !isCount(input.quantity)
    || !isInventoryDate(input.receivedDate) || (input.explanation !== undefined && typeof input.explanation !== 'string')) {
    throw new Error('Enter a valid delivery quantity and received date.');
  }
  const total = resolveDeliveryCost(input.quantity, input.costPerUnitMinor ?? null, input.totalAcquisitionCostMinor);
  const newQuantity = previousQuantity + input.quantity;
  if (!isCount(newQuantity)) throw new Error('The resulting stock quantity is too large.');
  return {
    id: historyId(snapshot, stock.id, timestamp), stockId: stock.id, previousQuantity, newQuantity,
    reason: 'Restocked', explanation: input.explanation?.trim() ?? '', timestamp, kind: 'delivery', sourceStockId: null,
    receipt: { quantityReceived: input.quantity, costPerUnitMinor: input.costPerUnitMinor ?? null, totalAcquisitionCostMinor: total,
      receivedDate: input.receivedDate, location: stock.location, remainingAtImport: null },
  };
}

/** Initial balance and its receipt are committed together. */
export function addStockInSnapshot(snapshot: InventorySnapshot, input: CreateStockInput, id: string, timestamp: string): { snapshot: InventorySnapshot; result: StockRecord } {
  const location = snapshot.locations.find((name) => isSameLocation(name, input.location));
  if (!location) throw new Error('Select a saved location or add a new one first.');
  if (snapshot.stocks.some((stock) => stock.id === id)) throw new Error('Stock ID already exists.');
  const stock = createStock({ ...input, location }, id, timestamp);
  assertUniqueProduct(snapshot.stocks, stock);
  const entry = deliveryEntry(snapshot, stock, 0, {
    quantity: input.quantity, costPerUnitMinor: input.costPerUnitMinor, totalAcquisitionCostMinor: input.totalAcquisitionCostMinor, receivedDate: input.inventoryDate,
  }, timestamp);
  return { snapshot: { ...snapshot, stocks: [...snapshot.stocks, stock], quantityHistory: [...snapshot.quantityHistory, entry] }, result: stock };
}

/** A receipt owns its price; stock quantity is only the current total balance. */
export function receiveStockInSnapshot(snapshot: InventorySnapshot, id: string, input: ReceiveStockInput, timestamp: string): { snapshot: InventorySnapshot; result: StockRecord } {
  const original = snapshot.stocks.find((stock) => stock.id === id);
  if (!original) throw new Error('This stock record could not be found.');
  if (!isCount(input.quantity) || input.quantity === 0) throw new Error('Received quantity must be a positive whole number.');
  const entry = deliveryEntry(snapshot, original, original.quantity, input, timestamp);
  const stock = { ...original, quantity: original.quantity + input.quantity,
    inventoryDate: original.inventoryDate > input.receivedDate ? original.inventoryDate : input.receivedDate, lastUpdatedAt: timestamp };
  return { snapshot: { ...snapshot, stocks: snapshot.stocks.map((record) => record.id === id ? stock : record),
    quantityHistory: [...snapshot.quantityHistory, entry] }, result: stock };
}

export function quantityReasonError(reason: QuantityChangeReason | null | undefined, previous: number, next: number): string | null {
  if (!reason || !QUANTITY_CHANGE_REASONS.includes(reason)) return 'Choose a reason for the quantity change.';
  if (reason === 'Restocked') return 'Use Receive stock to record the delivery date and cost.';
  if ((reason === 'Sold' || reason === 'Damaged') && next > previous) return `${reason} must decrease the remaining quantity.`;
  return null;
}

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
  // Existing records made under the old measurement-based rule stay editable.
  // Recheck unit corrections too, so old unit variants cannot become identical.
  const measurementChanged = (record.measurementPerUnit ?? '').toLocaleLowerCase() !== (original.measurementPerUnit ?? '').toLocaleLowerCase();
  if (productKey(record) !== productKey(original) || measurementChanged) assertUniqueProduct(snapshot.stocks, record, record.id);
  if (record === original) return { snapshot, result: record };
  let quantityHistory = snapshot.quantityHistory;
  if (record.quantity !== original.quantity) {
    const reason = input.quantityChangeReason;
    const reasonError = quantityReasonError(reason, original.quantity, record.quantity);
    if (reasonError || !reason) throw new Error(reasonError ?? 'Choose a reason for the quantity change.');
    if (input.quantityChangeExplanation !== undefined && typeof input.quantityChangeExplanation !== 'string') {
      throw new Error('The quantity explanation must be text.');
    }
    let suffix = quantityHistory.length;
    let id = `${stockId}:${timestamp}:${suffix}`;
    while (quantityHistory.some((entry) => entry.id === id)) id = `${stockId}:${timestamp}:${++suffix}`;
    quantityHistory = [...quantityHistory, {
      id, stockId, previousQuantity: original.quantity, newQuantity: record.quantity,
      reason, explanation: input.quantityChangeExplanation?.trim() ?? '', timestamp,
      kind: 'adjustment', receipt: null, sourceStockId: null,
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

export function acquisitionCost(quantity: number | null, costPerUnitMinor: number | null): number | null {
  if (quantity === null) {
    if (costPerUnitMinor !== null && !isCount(costPerUnitMinor)) throw new Error('Enter a valid cost per unit.');
    return null;
  }
  if (!isCount(quantity)) throw new Error('Quantity must be a nonnegative whole number.');
  if (costPerUnitMinor === null) return null;
  const total = quantity * costPerUnitMinor;
  if (!isCount(quantity) || !isCount(costPerUnitMinor) || !Number.isSafeInteger(total)) {
    throw new Error('Quantity and cost must produce a valid, safely representable total.');
  }
  return total;
}

/** An entered invoice total takes precedence; blank totals use the unit-price suggestion. */
export function resolveDeliveryCost(quantity: number | null, cost: number | null, total?: number | null): number | null {
  if (cost !== null && !isCount(cost)) throw new Error('Enter a valid cost per unit.');
  if (total !== undefined && total !== null) {
    if (!isCount(total)) throw new Error('Enter a valid total acquisition cost.');
    return total;
  }
  return acquisitionCost(quantity, cost);
}

/** Older v5 receipts have no saved total; retain their previous calculated display. */
export function receiptAcquisitionCost(receipt: DeliveryReceipt): number | null {
  return receipt.totalAcquisitionCostMinor === undefined
    ? acquisitionCost(receipt.quantityReceived, receipt.costPerUnitMinor)
    : receipt.totalAcquisitionCostMinor;
}

export function validateDeliveryCosts(quantity: number | null, unitText: string, totalText: string) {
  const errors: { costPerUnit?: string; totalAcquisitionCost?: string } = {};
  const costPerUnitMinor = parseMoney(unitText);
  const enteredTotal = parseMoney(totalText);
  if (unitText.trim() && costPerUnitMinor === null) errors.costPerUnit = 'Enter a nonnegative amount with up to 2 decimals.';
  if (totalText.trim() && enteredTotal === null) errors.totalAcquisitionCost = 'Enter a nonnegative amount with up to 2 decimals.';
  let totalAcquisitionCostMinor: number | null = enteredTotal;
  if (!Object.keys(errors).length) {
    try { totalAcquisitionCostMinor = resolveDeliveryCost(quantity, costPerUnitMinor, enteredTotal); }
    catch { errors.totalAcquisitionCost = 'The calculated total is too large. Enter a valid delivery total or smaller unit cost.'; }
  }
  return { costPerUnitMinor, totalAcquisitionCostMinor, errors };
}

/** Correct receipt costs without rewriting quantities, movement timestamps, or history order. */
export function editDeliveryCostInSnapshot(snapshot: InventorySnapshot, stockId: string, entryId: string,
  input: EditDeliveryCostInput, timestamp: string): InventorySnapshot {
  const stock = snapshot.stocks.find((record) => record.id === stockId);
  const entry = snapshot.quantityHistory.find((record) => record.id === entryId && record.stockId === stockId);
  if (!stock || !entry?.receipt) throw new Error('This delivery could not be found.');
  const receipt = entry.receipt;
  if (!isTimestamp(timestamp) || typeof input.explanation !== 'string') throw new Error('Invalid delivery cost update.');
  if (input.costPerUnitMinor !== null && !isCount(input.costPerUnitMinor)) throw new Error('Enter a valid cost per unit.');
  if (input.totalAcquisitionCostMinor !== null && !isCount(input.totalAcquisitionCostMinor)) throw new Error('Enter a valid total acquisition cost.');
  const explanation = input.explanation.trim();
  if (receipt.costPerUnitMinor === input.costPerUnitMinor
    && receiptAcquisitionCost(receipt) === input.totalAcquisitionCostMinor && entry.explanation === explanation) return snapshot;
  return { ...snapshot,
    stocks: snapshot.stocks.map((record) => record.id === stockId ? { ...record, lastUpdatedAt: timestamp } : record),
    quantityHistory: snapshot.quantityHistory.map((record) => record.id === entryId ? { ...record, explanation,
      receipt: { ...receipt, costPerUnitMinor: input.costPerUnitMinor,
        totalAcquisitionCostMinor: input.totalAcquisitionCostMinor, costUpdatedAt: timestamp } } : record),
  };
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
  resolveDeliveryCost(input.quantity, input.costPerUnitMinor ?? null, input.totalAcquisitionCostMinor);
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
    measurementPerUnit: input.measurementPerUnit === undefined ? record.measurementPerUnit : input.measurementPerUnit,
    quantityAlertThreshold: input.quantityAlertThreshold === undefined ? record.quantityAlertThreshold : input.quantityAlertThreshold,
    quantity: input.quantity, notes: input.notes,
    inventoryDate: record.inventoryDate,
  }, record.id, record.created_at);
  if (!isTimestamp(timestamp)) throw new Error('Could not update the timestamp.');
  if (record.name === updated.name && record.location === updated.location
    && record.measurementPerUnit === updated.measurementPerUnit
    && record.quantityAlertThreshold === updated.quantityAlertThreshold
    && record.quantity === updated.quantity && record.notes === updated.notes
    && record.inventoryDate === updated.inventoryDate) return record;
  return { ...updated, lastUpdatedAt: timestamp };
}

/** Null preserves unknown historical receipts rather than inventing an opening balance. */
export function validateReceiptQuantity(received: number | null, remaining: number, cost: number | null): void {
  if (received !== null && (!isCount(received) || received < remaining)) {
    throw new Error('Received quantity must be a nonnegative whole number at least as large as the remaining quantity.');
  }
  acquisitionCost(received, cost);
}

export function summarizeStock(stock: StockRecord): StockSummary {
  return {
    ...stock,
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
  return { name: '', quantity: '', location: '', costPerUnit: '', totalAcquisitionCost: '', measurementPerUnit: '', quantityAlertThreshold: '', notes: '', inventoryDate: localToday() };
}

export function stockFormValues(stock: StockRecord): StockFormValues {
  return {
    name: stock.name, quantity: String(stock.quantity), location: stock.location,
    costPerUnit: '', totalAcquisitionCost: '', quantityAlertThreshold: String(stock.quantityAlertThreshold),
    measurementPerUnit: stock.measurementPerUnit ?? '',
    notes: stock.notes, inventoryDate: stock.inventoryDate,
  };
}

export function validateStockForm(values: StockFormValues, editing = false): StockFormResult {
  const errors: StockFormErrors = {};
  const quantity = parseWholeNumber(values.quantity);
  const costs = validateDeliveryCosts(quantity, values.costPerUnit, values.totalAcquisitionCost ?? '');
  const threshold = parseWholeNumber(values.quantityAlertThreshold);
  if (!values.name.trim()) errors.name = 'Enter a stock name.';
  if (!values.location.trim()) errors.location = 'Enter a location, such as Shelf A.';
  if (quantity === null) errors.quantity = 'Enter a nonnegative whole number.';
  if (!editing) Object.assign(errors, costs.errors);
  if (threshold === null) errors.quantityAlertThreshold = 'Enter a nonnegative whole number.';
  if (!isInventoryDate(values.inventoryDate)) errors.inventoryDate = 'Use a valid date in YYYY-MM-DD format.';
  if (Object.keys(errors).length || quantity === null || threshold === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      name: values.name.trim(), quantity, location: values.location.trim(), costPerUnitMinor: editing ? null : costs.costPerUnitMinor,
      totalAcquisitionCostMinor: editing ? null : costs.totalAcquisitionCostMinor,
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

export function deleteLocationFromSnapshot(snapshot: InventorySnapshot, name: string): InventorySnapshot {
  if (!snapshot.locations.some((location) => isSameLocation(location, name))) {
    throw new Error('This location no longer exists.');
  }
  if (snapshot.stocks.some((stock) => isSameLocation(stock.location, name))) {
    throw new Error('This location is used by an inventory item. Move its items to another location before deleting it.');
  }
  return { ...snapshot, locations: snapshot.locations.filter((location) => !isSameLocation(location, name)) };
}

