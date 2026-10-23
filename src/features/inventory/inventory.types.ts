/** Local calendar date, YYYY-MM-DD; not a UTC timestamp. */
export type InventoryDate = string;
export type Timestamp = string;

export interface StockRecord {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly location: string;
  readonly measurementPerUnit: string | null;
  readonly quantityAlertThreshold: number;
  readonly notes: string;
  readonly inventoryDate: InventoryDate;
  readonly lastUpdatedAt: Timestamp;
  readonly created_at: Timestamp;
}

export type CreateStockInput = Omit<StockRecord, 'id' | 'lastUpdatedAt' | 'created_at' | 'measurementPerUnit'> & {
  readonly costPerUnitMinor?: number | null;
  readonly totalAcquisitionCostMinor?: number | null;
  readonly measurementPerUnit?: string | null;
};
export type QuantityChangeReason = 'Restocked' | 'Sold' | 'Damaged' | 'Count correction' | 'Other';

export interface DeliveryReceipt {
  readonly quantityReceived: number | null;
  readonly costPerUnitMinor: number | null;
  /** Final delivery total, including fees. Absent only on older saved receipts. */
  readonly totalAcquisitionCostMinor?: number | null;
  readonly costUpdatedAt?: Timestamp;
  readonly receivedDate: InventoryDate;
  readonly location: string;
  /** Frozen balance for validating imported delivery histories; never a live stock balance. */
  readonly remainingAtImport: number | null;
}

export interface ReceiveStockInput {
  readonly quantity: number;
  readonly costPerUnitMinor?: number | null;
  readonly totalAcquisitionCostMinor?: number | null;
  readonly receivedDate: InventoryDate;
  readonly explanation?: string;
}

export interface EditDeliveryCostInput {
  readonly costPerUnitMinor: number | null;
  readonly totalAcquisitionCostMinor: number | null;
  readonly explanation: string;
}

export interface QuantityHistoryEntry {
  readonly id: string;
  readonly stockId: string;
  readonly previousQuantity: number | null;
  readonly newQuantity: number | null;
  readonly reason: QuantityChangeReason;
  readonly explanation: string;
  readonly timestamp: Timestamp;
  readonly kind: 'adjustment' | 'delivery' | 'legacy-adjustment' | 'legacy-receipt';
  readonly receipt: DeliveryReceipt | null;
  readonly sourceStockId: string | null;
}

export type EditStockInput = Pick<StockRecord, 'quantity' | 'notes'> & Partial<Pick<StockRecord,
  'name' | 'location' | 'measurementPerUnit' | 'quantityAlertThreshold'
>> & {
  readonly quantityChangeReason?: QuantityChangeReason;
  readonly quantityChangeExplanation?: string;
};

export interface StockSummary extends StockRecord {
  readonly isLowStock: boolean;
}

export type MovementPeriodDays = 7 | 30;

/** Derived from saved history; null totals exceed the safe display range. */
export interface StockMovementSummary {
  readonly startsOn: InventoryDate;
  readonly endsOn: InventoryDate;
  readonly totals: Readonly<Record<QuantityChangeReason, number | null>>;
  readonly netChange: number | null;
  readonly entryCount: number;
  readonly hasImportedReceipts: boolean;
}

export type StockSortField = 'created_at' | 'inventoryDate' | 'quantity' | 'location';
export type SortDirection = 'asc' | 'desc';

export interface InventoryListOptions {
  readonly search: string;
  readonly lowStockOnly: boolean;
  readonly sortBy: StockSortField;
  readonly direction: SortDirection;
}

export interface InventorySnapshot {
  readonly version: 5;
  readonly stocks: readonly StockRecord[];
  readonly locations: readonly string[];
  readonly quantityHistory: readonly QuantityHistoryEntry[];
  /** Legacy metadata preserved for compatibility; never used to generate records. */
  readonly demoSeeded?: boolean;
}

export interface StockFormValues {
  name: string;
  quantity: string;
  location: string;
  costPerUnit: string;
  totalAcquisitionCost: string;
  measurementPerUnit: string;
  quantityAlertThreshold: string;
  notes: string;
  inventoryDate: string;
}

export type StockFormErrors = Partial<Record<keyof StockFormValues, string>>;

export type ValidatedStockInput = CreateStockInput;

export type StockFormResult =
  | { readonly ok: true; readonly input: ValidatedStockInput }
  | { readonly ok: false; readonly errors: StockFormErrors };

export type StockSubmissionResult =
  | { readonly ok: true; readonly input: ValidatedStockInput }
  | {
    readonly ok: false;
    readonly errors: StockFormErrors;
    readonly reasonError: string | null;
    readonly message: string;
  };
