import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { addLocationToSnapshot, addStockInSnapshot, deleteLocationFromSnapshot, deleteStockInSnapshot, editDeliveryCostInSnapshot, editStockInSnapshot, receiveStockInSnapshot } from './inventory.logic';
import { inventoryStorage } from './inventory.storage';
import type { CreateStockInput, EditDeliveryCostInput, EditStockInput, InventorySnapshot, QuantityHistoryEntry, ReceiveStockInput, StockRecord } from './inventory.types';

interface InventoryContextValue {
  stocks: readonly StockRecord[];
  locations: readonly string[];
  quantityHistory: readonly QuantityHistoryEntry[];
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  notice: string | null;
  retryLoad: () => Promise<void>;
  dismissNotice: () => void;
  addStock: (input: CreateStockInput) => Promise<StockRecord>;
  addLocation: (name: string) => Promise<string>;
  deleteLocation: (name: string) => Promise<void>;
  editDeliveryCost: (stockId: string, entryId: string, input: EditDeliveryCostInput) => Promise<void>;
  editStock: (id: string, input: EditStockInput) => Promise<StockRecord>;
  receiveStock: (id: string, input: ReceiveStockInput) => Promise<StockRecord>;
  deleteStock: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot>({ version: 5, stocks: [], locations: [], quantityHistory: [] });
  const { stocks, locations, quantityHistory } = snapshot;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  const ready = useRef(false);
  const busy = useRef(false);
  const loading = useRef(false);
  const mounted = useRef(true);
  const idCounter = useRef(0);

  const retryLoad = useCallback(async () => {
    if (loading.current || ready.current || busy.current) return;
    loading.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const saved = await inventoryStorage.initialize();
      if (mounted.current) {
        snapshotRef.current = saved;
        setSnapshot(saved);
        ready.current = true;
      }
    } catch (error) {
      if (mounted.current) setLoadError(error instanceof Error ? error.message : 'Inventory could not be loaded. Please try again.');
    } finally {
      loading.current = false;
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void retryLoad();
    return () => { mounted.current = false; };
  }, [retryLoad]);

  const persistChange = useCallback(async <T,>(
    change: (current: InventorySnapshot) => { snapshot: InventorySnapshot; result: T },
    message: string,
  ): Promise<T> => {
    if (!ready.current) throw new Error('Wait for inventory to finish loading before saving.');
    if (busy.current) throw new Error('A save is already in progress. Please wait.');
    busy.current = true;
    setIsSaving(true);
    setNotice(null);
    try {
      const next = change(snapshotRef.current);
      if (next.snapshot !== snapshotRef.current) await inventoryStorage.save(next.snapshot);
      snapshotRef.current = next.snapshot;
      if (mounted.current) {
        setSnapshot(next.snapshot);
        setNotice(message);
      }
      return next.result;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Could not save stock. Your entries are still here; please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }, []);

  const addStock = useCallback((input: CreateStockInput) => persistChange((current) => {
    let id: string;
    do {
      idCounter.current += 1;
      id = `stock-${Date.now().toString(36)}-${idCounter.current.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    } while (current.stocks.some((stock) => stock.id === id));
    return addStockInSnapshot(current, input, id, new Date().toISOString());
  }, 'Stock added successfully.'), [persistChange]);

  const editStock = useCallback((id: string, input: EditStockInput) => persistChange(
    (current) => editStockInSnapshot(current, id, input, new Date().toISOString()),
    'Stock changes saved.',
  ), [persistChange]);

  const addLocation = useCallback((name: string) => persistChange((current) => {
    const next = addLocationToSnapshot(current, name);
    return { snapshot: next.snapshot, result: next.location };
  }, 'Location saved.'), [persistChange]);

  const deleteLocation = useCallback((name: string) => persistChange((current) => ({
    snapshot: deleteLocationFromSnapshot(current, name), result: undefined,
  }), 'Location deleted.'), [persistChange]);

  const editDeliveryCost = useCallback((stockId: string, entryId: string, input: EditDeliveryCostInput) => persistChange((current) => ({
    snapshot: editDeliveryCostInSnapshot(current, stockId, entryId, input, new Date().toISOString()), result: undefined,
  }), 'Delivery costs saved.'), [persistChange]);

  const receiveStock = useCallback((id: string, input: ReceiveStockInput) => persistChange(
    (current) => receiveStockInSnapshot(current, id, input, new Date().toISOString()),
    'Delivery saved.',
  ), [persistChange]);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const deleteStock = useCallback((id: string) => persistChange((current) => ({
    snapshot: deleteStockInSnapshot(current, id), result: undefined,
  }), 'Inventory item deleted.'), [persistChange]);

  const value = useMemo(() => ({ stocks, locations, quantityHistory, isLoading, isSaving, loadError, notice, retryLoad, dismissNotice, addStock, addLocation, deleteLocation, editDeliveryCost, editStock, receiveStock, deleteStock }),
    [stocks, locations, quantityHistory, isLoading, isSaving, loadError, notice, retryLoad, dismissNotice, addStock, addLocation, deleteLocation, editDeliveryCost, editStock, receiveStock, deleteStock]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within InventoryProvider.');
  return context;
}
