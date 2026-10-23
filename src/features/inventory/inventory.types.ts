/** Local calendar date, YYYY-MM-DD; not a UTC timestamp. */
export type InventoryDate = string;
export type Timestamp = string;

export interface StockRecord {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly location: string;
  readonly costPerUnitMinor: number | null;
  readonly measurementPerUnit: string | null;
  readonly quantityAlertThreshold: number;
  readonly notes: string;
  readonly inventoryDate: InventoryDate;
  readonly lastUpdatedAt: Timestamp;
  readonly created_at: Timestamp;
}

export type CreateStockInput = Omit<StockRecord, 'id' | 'lastUpdatedAt' | 'created_at' | 'costPerUnitMinor' | 'measurementPerUnit'> & {
  readonly costPerUnitMinor?: number | null;
  readonly measurementPerUnit?: string | null;
};
export type QuantityChangeReason = 'Restocked' | 'Sold' | 'Damaged' | 'Count correction' | 'Other';

export interface QuantityHistoryEntry {
  readonly id: string;
  readonly stockId: string;
  readonly previousQuantity: number;
  readonly newQuantity: number;
  readonly reason: QuantityChangeReason;
  readonly explanation: string;
  readonly timestamp: Timestamp;
}

export type EditStockInput = Pick<StockRecord, 'quantity' | 'notes'> & Partial<Pick<StockRecord,
  'name' | 'location' | 'costPerUnitMinor' | 'measurementPerUnit' | 'quantityAlertThreshold' | 'inventoryDate'
>> & {
  readonly quantityChangeReason?: QuantityChangeReason;
  readonly quantityChangeExplanation?: string;
};

export interface StockSummary extends StockRecord {
  readonly totalAcquisitionCostMinor: number | null;
  readonly isLowStock: boolean;
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
  readonly version: 3;
  readonly stocks: readonly StockRecord[];
  readonly locations: readonly string[];
  readonly quantityHistory: readonly QuantityHistoryEntry[];
  /** Absent in older snapshots; saved atomically with the one-time sample records. */
  readonly demoSeeded?: boolean;
}

export interface StockFormValues {
  name: string;
  quantity: string;
  location: string;
  costPerUnit: string;
  measurementPerUnit: string;
  quantityAlertThreshold: string;
  notes: string;
  inventoryDate: string;
}

export type StockFormErrors = Partial<Record<keyof StockFormValues, string>>;

export type StockFormResult =
  | { readonly ok: true; readonly input: CreateStockInput }
  | { readonly ok: false; readonly errors: StockFormErrors };

export type StockSubmissionResult =
  | { readonly ok: true; readonly input: CreateStockInput }
  | {
    readonly ok: false;
    readonly errors: StockFormErrors;
    readonly reasonError: string | null;
    readonly message: string;
  };
